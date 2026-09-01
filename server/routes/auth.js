/**
 * ============================================================================
 * FlakeSecure Server - Authentication Routes (/api/auth)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ENDPOINTS:
 * 
 * 1. POST /register:
 *    - Validates email, lowercase username, password rules (min. 8 characters, no whitespace), and email OTP verification token.
 *    - Securely hashes password using argon2.hash.
 *    - Creates user in PostgreSQL, generates a 24h JWT, and stores the session in the sessions table.
 * 
 * 2. POST /login:
 *    - Finds user by email or username (case-insensitive lowercase).
 *    - Verifies password with argon2.verify.
 *    - Creates a new 24h session and records the login with IP, GeoIP data (geoip-lite), and device info in login_logs.
 *    - Triggers push notification to other active devices registered by the user.
 * 
 * 3. POST /logout:
 *    - Requires authentication.
 *    - Deletes the active session from the sessions table by token hash.
 * 
 * 4. GET /me:
 *    - Requires authentication.
 *    - Returns user profile (id, email, username, language, share_mode, created_at).
 * ============================================================================
 */

const express = require('express');
const argon2 = require('argon2');
const geoip = require('geoip-lite');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware, createToken, hashToken } = require('../middleware/auth');
const { sendPushToUser } = require('./notifications');

const router = express.Router();

router.post('/register', async (req, res) => {
    let { email, username, password, otpToken } = req.body;
    if (!email || !username || !password) {
        return res.status(400).json({ error: 'Email, username, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
        return res.status(400).json({ error: 'Username can only contain lowercase letters (a-z), numbers (0-9), hyphens (-), and underscores (_)' });
    }

    if (/\s/.test(password)) {
        return res.status(400).json({ error: 'Password cannot contain spaces or whitespace characters' });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (otpToken) {
        try {
            const decoded = jwt.verify(otpToken, process.env.JWT_SECRET);
            if (decoded.email !== cleanEmail || decoded.purpose !== 'register' || !decoded.verified) {
                return res.status(400).json({ error: 'Invalid or expired email verification token' });
            }
        } catch (otpErr) {
            return res.status(400).json({ error: 'Email verification required. Please verify your email first.' });
        }
    }

    try {
        const passwordHash = await argon2.hash(password);
        const { rows } = await db.query(
            'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username, language, share_mode, created_at',
            [cleanEmail, cleanUsername, passwordHash]
        );
        const user = rows[0];

        const token = createToken(user);
        const tHash = hashToken(token);
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const deviceInfo = req.headers['user-agent'] || 'Unknown Device';

        await db.query(
            "INSERT INTO sessions (user_id, token_hash, device_info, ip_address, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')",
            [user.id, tHash, deviceInfo, ip.split(',')[0].trim()]
        );

        res.status(201).json({ user, token });
    } catch (error) {
        console.error('Register error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Username or email already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    let { identifier, password } = req.body;
    if (!identifier || !password) {
        return res.status(400).json({ error: 'Identifier and password are required' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    try {
        const { rows } = await db.query(
            'SELECT * FROM users WHERE email = $1 OR username = $1',
            [cleanIdentifier]
        );
        const user = rows[0];

        if (!user || !(await argon2.verify(user.password_hash, password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = createToken(user);
        const tHash = hashToken(token);
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const cleanIp = ip.split(',')[0].trim();
        const deviceInfo = req.headers['user-agent'] || 'Unknown Device';

        await db.query(
            "INSERT INTO sessions (user_id, token_hash, device_info, ip_address, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')",
            [user.id, tHash, deviceInfo, cleanIp]
        );

        const geo = geoip.lookup(cleanIp);
        const city = geo ? geo.city : null;
        const region = geo ? geo.region : null;
        const country = geo ? geo.country : null;
        const domain = req.headers.origin || null;

        await db.query(
            'INSERT INTO login_logs (user_id, ip_address, city, region, country, device_info, action, domain) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [user.id, cleanIp, city, region, country, deviceInfo, 'login', domain]
        );

        try {
            const loginDevice = deviceInfo.substring(0, 50);
            await sendPushToUser(
                user.id,
                '❄️ Neuer Login erkannt',
                `Anmeldung von ${loginDevice} (${city || country || 'Unbekannter Ort'})`,
                { type: 'new_login', device: loginDevice }
            );
        } catch (pushErr) {
            console.log('[FlakeSecure] Push notification skipped:', pushErr.message);
        }

        delete user.password_hash;
        res.json({ user, token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/logout', authMiddleware, async (req, res) => {
    try {
        await db.query('DELETE FROM sessions WHERE token_hash = $1', [req.sessionHash]);
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, email, username, language, share_mode, created_at, updated_at FROM users WHERE id = $1', [req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user: rows[0] });
    } catch (error) {
        console.error('Me error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
