/**
 * ============================================================================
 * FlakeSecure Server - JWT & Session Authentication Middleware
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. TOKEN GENERATION & HASHING:
 *    - createToken(user): Generates a signed JSON Web Token (JWT) with user payload and 24h validity.
 *    - hashToken(token): Generates a SHA-256 hash of the token for secure session storage and DB indexing.
 * 
 * 2. AUTH MIDDLEWARE:
 *    - authMiddleware(req, res, next): Validates Authorization Bearer header, verifies JWT signature against JWT_SECRET, checks active DB session validity, and attaches req.user, req.sessionToken, and req.sessionHash to the request object.
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

function createToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid token' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Token is invalid or expired' });
        }

        const tHash = hashToken(token);
        const { rows } = await db.query(
            'SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > NOW()',
            [tHash]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Session not found or expired' });
        }

        req.user = decoded;
        req.sessionToken = token;
        req.sessionHash = tHash;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    authMiddleware,
    createToken,
    hashToken
};
