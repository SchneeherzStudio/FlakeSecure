/**
 * ============================================================================
 * FlakeSecure Server - Credential Sharing & Relay Routes (/api/share)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ENDPOINTS:
 * 
 * 1. POST /create:
 *    - Creates a new encrypted sharing payload in the database (shared_payloads table).
 *    - Validates recipient sharing permissions (only_me, allowed_recipients whitelist, or all).
 *    - Supports metadata such as 'hidden' (recipient cannot view plaintext in UI) and 'expiresInHours'.
 * 
 * 2. GET /status/:sid:
 *    - Queries the state of a share session ('consumed', 'pending', 'expired').
 * 
 * 3. DELETE /cancel/:sid:
 *    - Cancels a pending sharing session and removes it from the database.
 * 
 * 4. GET /consume/:sid:
 *    - Consumes the payload once (one-time read), immediately deletes it from the database, and marks the session as consumed in the in-memory tracker.
 * ============================================================================
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const consumedSessions = new Map();

function cleanOldConsumedSessions() {
    const now = Date.now();
    for (const [sid, info] of consumedSessions) {
        if (now - info.timestamp > 10 * 60 * 1000) {
            consumedSessions.delete(sid);
        }
    }
}
setInterval(cleanOldConsumedSessions, 60_000);

router.post('/create', async (req, res) => {
    const { sid, payload, recipient, hidden, expiresInHours } = req.body;
    
    if (!sid || !payload) {
        return res.status(400).json({ error: 'sid and payload are required' });
    }

    let senderId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            senderId = decoded.id;
        } catch (e) {}
    }

    if (recipient) {
        if (!senderId) {
            return res.status(401).json({ error: 'You must be logged in to share to a user' });
        }

        const cleanRecipient = typeof recipient === 'string' ? recipient.trim().toLowerCase() : recipient;

        try {
            const rRes = await db.query('SELECT id, share_mode FROM users WHERE username = $1', [cleanRecipient]);
            if (rRes.rows.length === 0) {
                return res.status(404).json({ error: 'Recipient not found' });
            }
            const recipientUser = rRes.rows[0];

            if (recipientUser.share_mode === 'only_me') {
                return res.status(403).json({ error: 'Recipient does not accept shared logins' });
            }

            if (recipientUser.share_mode === 'whitelist') {
                const allowRes = await db.query(
                    'SELECT 1 FROM allowed_recipients WHERE owner_id = $1 AND recipient_id = $2',
                    [recipientUser.id, senderId]
                );
                if (allowRes.rows.length === 0) {
                    return res.status(403).json({ error: 'You are not in the recipient\'s whitelist' });
                }
            }
        } catch (error) {
            console.error('Share check error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    try {
        const wrappedPayload = JSON.stringify({
            data: typeof payload === 'string' ? payload : JSON.stringify(payload),
            hidden: !!hidden,
            expiresInHours: expiresInHours || null,
        });
        
        await db.query(
            "INSERT INTO shared_payloads (sid, payload, created_at) VALUES ($1, $2, NOW())",
            [sid, wrappedPayload]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Share create error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/status/:sid', async (req, res) => {
    const { sid } = req.params;
    
    if (consumedSessions.has(sid)) {
        return res.json({ status: 'consumed', success: true });
    }

    try {
        const { rows } = await db.query('SELECT 1 FROM shared_payloads WHERE sid = $1', [sid]);
        if (rows.length > 0) {
            return res.json({ status: 'pending' });
        }

        return res.json({ status: 'expired' });
    } catch (error) {
        console.error('Share status check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/cancel/:sid', async (req, res) => {
    const { sid } = req.params;
    try {
        await db.query('DELETE FROM shared_payloads WHERE sid = $1', [sid]);
        consumedSessions.delete(sid);
        res.json({ success: true });
    } catch (error) {
        console.error('Share cancel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/consume/:sid', async (req, res) => {
    const { sid } = req.params;
    try {
        const { rows } = await db.query('SELECT payload FROM shared_payloads WHERE sid = $1', [sid]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Payload not found or expired' });
        }

        const rawPayload = rows[0].payload;
        let parsed;
        try {
            parsed = JSON.parse(rawPayload);
        } catch {
            parsed = { data: rawPayload, hidden: false, expiresInHours: null };
        }
        
        await db.query('DELETE FROM shared_payloads WHERE sid = $1', [sid]);
        consumedSessions.set(sid, { timestamp: Date.now(), status: 'consumed' });

        res.json({ payload: parsed.data, hidden: parsed.hidden || false, expiresInHours: parsed.expiresInHours || null });
    } catch (error) {
        console.error('Share consume error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
