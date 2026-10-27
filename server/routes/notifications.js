/**
 * ============================================================================
 * FlakeSecure Server - Push Notification Routes (/api/notifications)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ENDPOINTS:
 * 
 * 1. POST /register:
 *    - Registers an Expo push token for the authenticated user's device.
 *    - Resolves coarse 2-letter ISO country code in RAM via geoip-lite (never stores raw IP).
 *    - Validates the token format with Expo.isExpoPushToken().
 *    - Upserts into push_tokens table.
 * 
 * 2. DELETE /unregister:
 *    - Removes a specific Expo push token for the authenticated user.
 * 
 * 3. GET /status:
 *    - Returns the count of registered push token devices and whether notifications are enabled for the user.
 * 
 * 4. GET /preferences & PUT /preferences:
 *    - Retrieves and updates per-category push notification preferences for the user.
 * 
 * 5. POST /admin/send:
 *    - Admin endpoint to dispatch custom push notifications and/or in-app announcements with deep-link target_screen and regional targeting.
 * 
 * 6. EXPORTED HELPERS:
 *    - sendPushToUser(userId, title, body, data, category)
 *    - sendBroadcastPush({ title, body, data, regions, category })
 * ============================================================================
 */

const express = require('express');
const { Expo } = require('expo-server-sdk');
const geoip = require('geoip-lite');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getClientIp } = require('../middleware/rateLimit');
const { requireAdminAuth, logServerEvent } = require('./admin');

const router = express.Router();
const expo = new Expo();

const VALID_CATEGORIES = [
    'login_alerts',
    'security_alerts',
    'share_alerts',
    'system_announcements',
    'custom_pushes'
];

const DEFAULT_PREFS = {
    login_alerts: true,
    security_alerts: true,
    share_alerts: true,
    system_announcements: true,
    custom_pushes: true
};

function formatPrefsResponse(row) {
    const base = {
        login_alerts: row ? row.login_alerts !== false : true,
        security_alerts: row ? row.security_alerts !== false : true,
        share_alerts: row ? row.share_alerts !== false : true,
        system_announcements: row ? row.system_announcements !== false : true,
        custom_pushes: row ? row.custom_pushes !== false : true
    };
    return {
        ...base,
        new_device_login: base.login_alerts,
        failed_login_attempts: base.security_alerts,
        share_events: base.share_alerts,
        share_expiring: base.system_announcements,
        vault_sync_conflict: base.custom_pushes
    };
}

function extractIncomingPrefs(body = {}, current = DEFAULT_PREFS) {
    const src = (body && typeof body.preferences === 'object' && body.preferences !== null)
        ? { ...body, ...body.preferences }
        : (body || {});

    const pickBool = (primaryKey, aliasKey, fallbackVal) => {
        if (typeof src[primaryKey] === 'boolean') return src[primaryKey];
        if (aliasKey && typeof src[aliasKey] === 'boolean') return src[aliasKey];
        return fallbackVal !== false;
    };

    return {
        login_alerts: pickBool('login_alerts', 'new_device_login', current.login_alerts),
        security_alerts: pickBool('security_alerts', 'failed_login_attempts', current.security_alerts),
        share_alerts: pickBool('share_alerts', 'share_events', current.share_alerts),
        system_announcements: pickBool('system_announcements', 'share_expiring', current.system_announcements),
        custom_pushes: pickBool('custom_pushes', 'vault_sync_conflict', current.custom_pushes)
    };
}

router.post('/register', authMiddleware, async (req, res) => {
    const { expo_token, device_info, language, preferences } = req.body;

    if (!expo_token) {
        return res.status(400).json({ error: 'Expo push token is required' });
    }

    if (!Expo.isExpoPushToken(expo_token)) {
        return res.status(400).json({ error: 'Invalid Expo push token format' });
    }

    try {
        const ip = getClientIp(req);
        const geo = ip ? geoip.lookup(ip) : null;
        const country = (geo && geo.country) ? String(geo.country).toUpperCase().slice(0, 5) : null;
        const normalizedLang = (language && typeof language === 'string')
            ? language.trim().toLowerCase().slice(0, 5)
            : null;

        await db.query(
            `INSERT INTO push_tokens (user_id, expo_token, device_info, country, language)
             VALUES ($1, $2, $3, $4, COALESCE($5, 'de'))
             ON CONFLICT (user_id, expo_token) DO UPDATE SET
               device_info = COALESCE($3, push_tokens.device_info),
               country = COALESCE($4, push_tokens.country),
               language = COALESCE($5, push_tokens.language),
               updated_at = NOW()`,
            [req.user.id, expo_token, device_info || null, country, normalizedLang]
        );

        if (preferences && typeof preferences === 'object') {
            const nextPrefs = extractIncomingPrefs({ preferences }, DEFAULT_PREFS);
            await db.query(
                `INSERT INTO notification_prefs (
                    user_id, login_alerts, security_alerts, share_alerts, system_announcements, custom_pushes, updated_at
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (user_id) DO UPDATE SET
                    login_alerts = EXCLUDED.login_alerts,
                    security_alerts = EXCLUDED.security_alerts,
                    share_alerts = EXCLUDED.share_alerts,
                    system_announcements = EXCLUDED.system_announcements,
                    custom_pushes = EXCLUDED.custom_pushes,
                    updated_at = NOW()`,
                [
                    req.user.id,
                    nextPrefs.login_alerts,
                    nextPrefs.security_alerts,
                    nextPrefs.share_alerts,
                    nextPrefs.system_announcements,
                    nextPrefs.custom_pushes
                ]
            );
        }

        res.json({ success: true, country });
    } catch (error) {
        console.error('Push register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/unregister', authMiddleware, async (req, res) => {
    const { expo_token } = req.body;

    if (!expo_token) {
        return res.status(400).json({ error: 'Expo push token is required' });
    }

    try {
        await db.query(
            'DELETE FROM push_tokens WHERE user_id = $1 AND expo_token = $2',
            [req.user.id, expo_token]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Push unregister error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/status', authMiddleware, async (req, res) => {
    try {
        const [tokensRes, prefsRes] = await Promise.all([
            db.query('SELECT COUNT(*) FROM push_tokens WHERE user_id = $1', [req.user.id]),
            db.query(
                `SELECT login_alerts, security_alerts, share_alerts, system_announcements, custom_pushes
                 FROM notification_prefs WHERE user_id = $1`,
                [req.user.id]
            )
        ]);

        const count = parseInt(tokensRes.rows[0].count, 10);
        const preferences = formatPrefsResponse(prefsRes.rows[0]);
        res.json({ enabled: count > 0, devices: count, preferences });
    } catch (error) {
        console.error('Push status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/preferences', authMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT login_alerts, security_alerts, share_alerts, system_announcements, custom_pushes
             FROM notification_prefs WHERE user_id = $1`,
            [req.user.id]
        );

        const formatted = formatPrefsResponse(rows[0]);
        res.json({ ...formatted, preferences: formatted });
    } catch (error) {
        console.error('Get notification preferences error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/preferences', authMiddleware, async (req, res) => {
    try {
        const currentRes = await db.query(
            `SELECT login_alerts, security_alerts, share_alerts, system_announcements, custom_pushes
             FROM notification_prefs WHERE user_id = $1`,
            [req.user.id]
        );
        const current = currentRes.rows[0] || DEFAULT_PREFS;
        const nextPrefs = extractIncomingPrefs(req.body, current);

        const { rows } = await db.query(
            `INSERT INTO notification_prefs (
                user_id, login_alerts, security_alerts, share_alerts, system_announcements, custom_pushes, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (user_id) DO UPDATE SET
                login_alerts = EXCLUDED.login_alerts,
                security_alerts = EXCLUDED.security_alerts,
                share_alerts = EXCLUDED.share_alerts,
                system_announcements = EXCLUDED.system_announcements,
                custom_pushes = EXCLUDED.custom_pushes,
                updated_at = NOW()
             RETURNING login_alerts, security_alerts, share_alerts, system_announcements, custom_pushes`,
            [
                req.user.id,
                nextPrefs.login_alerts,
                nextPrefs.security_alerts,
                nextPrefs.share_alerts,
                nextPrefs.system_announcements,
                nextPrefs.custom_pushes
            ]
        );

        if (req.body && typeof req.body.language === 'string' && req.body.language.trim()) {
            const lang = req.body.language.trim().toLowerCase().slice(0, 5);
            await db.query('UPDATE push_tokens SET language = $1, updated_at = NOW() WHERE user_id = $2', [lang, req.user.id]).catch(() => {});
        }

        const formatted = formatPrefsResponse(rows[0]);
        res.json({ ...formatted, preferences: formatted });
    } catch (error) {
        console.error('Update notification preferences error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function sendPushToUser(userId, title, body, data = {}, category = null) {
    try {
        if (category && VALID_CATEGORIES.includes(category)) {
            const prefRes = await db.query(
                `SELECT ${category} FROM notification_prefs WHERE user_id = $1`,
                [userId]
            );
            if (prefRes.rows.length > 0 && prefRes.rows[0][category] === false) {
                return;
            }
        }

        const { rows: tokens } = await db.query(
            'SELECT expo_token FROM push_tokens WHERE user_id = $1',
            [userId]
        );

        if (tokens.length === 0) return;

        const messages = tokens
            .filter(t => Expo.isExpoPushToken(t.expo_token))
            .map(t => ({
                to: t.expo_token,
                sound: 'default',
                title,
                body,
                data
            }));

        if (messages.length === 0) return;

        const chunks = expo.chunkPushNotifications(messages);

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

                for (let i = 0; i < ticketChunk.length; i++) {
                    const ticket = ticketChunk[i];
                    if (ticket.status === 'error' && ticket.details && ticket.details.error === 'DeviceNotRegistered') {
                        await db.query(
                            'DELETE FROM push_tokens WHERE user_id = $1 AND expo_token = $2',
                            [userId, chunk[i].to]
                        );
                    }
                }
            } catch (error) {
                console.error('Push send error:', error);
            }
        }
    } catch (error) {
        console.error('sendPushToUser error:', error);
    }
}

function matchesRegionFilter(tokenRow, regionList) {
    if (!regionList || regionList.length === 0 || regionList.includes('ALL') || regionList.includes('*')) {
        return true;
    }
    const tokenCountry = tokenRow.country ? String(tokenRow.country).trim().toUpperCase() : null;
    if (tokenCountry) {
        return regionList.includes(tokenCountry);
    }
    // Fallback when country is null (e.g. local/VPN): match by language code
    const lang = tokenRow.language ? String(tokenRow.language).trim().toUpperCase() : '';
    if (!lang) return false;
    if (lang === 'EN') {
        return regionList.includes('EN') || regionList.includes('US') || regionList.includes('GB');
    }
    return regionList.includes(lang);
}

async function sendBroadcastPush({ title, body, data = {}, regions = 'ALL', category = 'custom_pushes' }) {
    try {
        const safeCategory = VALID_CATEGORIES.includes(category) ? category : 'custom_pushes';
        const { rows } = await db.query(
            `SELECT pt.user_id, pt.expo_token, pt.country, pt.language,
                    np.login_alerts, np.security_alerts, np.share_alerts, np.system_announcements, np.custom_pushes
             FROM push_tokens pt
             LEFT JOIN notification_prefs np ON np.user_id = pt.user_id
             INNER JOIN users u ON u.id = pt.user_id
             WHERE u.deleted_at IS NULL`
        );

        const rawRegions = (regions && String(regions).trim()) ? String(regions).trim().toUpperCase() : 'ALL';
        const regionList = rawRegions.split(',').map(s => s.trim()).filter(Boolean);

        const eligibleTokens = rows.filter(row => {
            if (row[safeCategory] === false) return false;
            if (!Expo.isExpoPushToken(row.expo_token)) return false;
            return matchesRegionFilter(row, regionList);
        });

        const targetedDevices = eligibleTokens.length;
        if (targetedDevices === 0) {
            return { sentCount: 0, targetedDevices: 0 };
        }

        const messages = eligibleTokens.map(row => ({
            to: row.expo_token,
            sound: 'default',
            title: title || 'FlakeSecure',
            body,
            data,
            _userId: row.user_id
        }));

        const cleanMessages = messages.map(({ _userId, ...msg }) => msg);
        const chunks = expo.chunkPushNotifications(cleanMessages);
        let sentCount = 0;

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                for (let i = 0; i < ticketChunk.length; i++) {
                    const ticket = ticketChunk[i];
                    if (ticket.status === 'ok') {
                        sentCount++;
                    } else if (ticket.status === 'error' && ticket.details && ticket.details.error === 'DeviceNotRegistered') {
                        await db.query(
                            'DELETE FROM push_tokens WHERE expo_token = $1',
                            [chunk[i].to]
                        );
                    }
                }
            } catch (err) {
                console.error('Broadcast push chunk error:', err);
            }
        }

        return { sentCount, targetedDevices };
    } catch (error) {
        console.error('sendBroadcastPush error:', error);
        return { sentCount: 0, targetedDevices: 0, error: error.message };
    }
}

router.post('/admin/send', requireAdminAuth, async (req, res) => {
    const {
        title = null,
        message,
        type = 'popup',
        display = 'once',
        priority = 0,
        expires_at = null,
        target_screen = null,
        regions = 'ALL',
        delivery_mode = 'both'
    } = req.body;

    if (!message || !String(message).trim()) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const normalizedType = ['popup', 'banner'].includes(type) ? type : 'popup';
    const normalizedDisplay = ['once', 'always'].includes(display) ? display : 'once';
    const normalizedMode = ['in_app', 'push', 'both'].includes(delivery_mode) ? delivery_mode : 'both';
    const normalizedRegions = (regions && String(regions).trim()) ? String(regions).trim().toUpperCase() : 'ALL';
    const cleanTitle = (title && String(title).trim()) ? String(title).trim().slice(0, 150) : null;
    const cleanTargetScreen = (target_screen && String(target_screen).trim()) ? String(target_screen).trim().slice(0, 50) : null;

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
                    normalizedType,
                    normalizedDisplay,
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

        if (typeof logServerEvent === 'function') {
            logServerEvent(
                'info',
                'ADMIN_NOTIFICATION_DISPATCHED',
                `Admin notification dispatched (mode=${normalizedMode}, regions=${normalizedRegions}, target=${cleanTargetScreen || 'none'})`
            );
        }

        res.status(201).json({
            success: true,
            announcement,
            pushResult
        });
    } catch (error) {
        console.error('Admin send notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = { router, sendPushToUser, sendBroadcastPush };
