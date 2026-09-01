/**
 * ============================================================================
 * FlakeSecure Server - Push Notification Routes (/api/notifications)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ENDPOINTS:
 * 
 * 1. POST /register:
 *    - Registers an Expo push token for the authenticated user's device.
 *    - Validates the token format with Expo.isExpoPushToken().
 *    - Upserts into push_tokens table (ON CONFLICT updates device_info).
 * 
 * 2. DELETE /unregister:
 *    - Removes a specific Expo push token for the authenticated user.
 * 
 * 3. GET /status:
 *    - Returns the count of registered push token devices and whether notifications are enabled for the user.
 * 
 * 4. EXPORTED HELPER:
 *    - sendPushToUser(userId, title, body, data): Sends push notifications to all registered tokens for a user via Expo SDK. Automatically removes invalid tokens on receipt errors.
 * ============================================================================
 */

const express = require('express');
const { Expo } = require('expo-server-sdk');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const expo = new Expo();

router.post('/register', authMiddleware, async (req, res) => {
    const { expo_token, device_info } = req.body;

    if (!expo_token) {
        return res.status(400).json({ error: 'Expo push token is required' });
    }

    if (!Expo.isExpoPushToken(expo_token)) {
        return res.status(400).json({ error: 'Invalid Expo push token format' });
    }

    try {
        await db.query(
            `INSERT INTO push_tokens (user_id, expo_token, device_info)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, expo_token) DO UPDATE SET device_info = $3, updated_at = NOW()`,
            [req.user.id, expo_token, device_info || null]
        );

        res.json({ success: true });
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
        const { rows } = await db.query(
            'SELECT COUNT(*) FROM push_tokens WHERE user_id = $1',
            [req.user.id]
        );

        const count = parseInt(rows[0].count);
        res.json({ enabled: count > 0, devices: count });
    } catch (error) {
        console.error('Push status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function sendPushToUser(userId, title, body, data = {}) {
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
}

module.exports = { router, sendPushToUser };
