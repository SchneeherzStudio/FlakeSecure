/**
 * ============================================================================
 * FlakeSecure Server - Account & Restriction Routes (/api/account)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ENDPOINTS:
 * 
 * 1. DELETE /delete:
 *    - Permanently deletes the authenticated user from the database (CASCADE removes sessions, logs, and restrictions).
 * 
 * 2. PUT /update:
 *    - Updates user language preferences and sharing mode (share_mode: 'only_me', 'whitelist', 'all').
 * 
 * 3. GET /restrictions:
 *    - Retrieves all allowed recipients for the authenticated user.
 * 
 * 4. POST /restrictions:
 *    - Adds a user to the allowed recipients whitelist by username.
 * 
 * 5. DELETE /restrictions/:recipientId:
 *    - Removes a recipient from the whitelist.
 * 
 * 6. GET /search?q=:
 *    - Searches registered users via case-insensitive ILIKE query (excludes self, limited to 10 results).
 * ============================================================================
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.delete('/delete', authMiddleware, async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/update', authMiddleware, async (req, res) => {
    const { language, share_mode } = req.body;
    
    try {
        let updateQuery = 'UPDATE users SET updated_at = NOW()';
        const params = [];
        let paramCount = 1;

        if (language) {
            updateQuery += `, language = $${paramCount}`;
            params.push(language);
            paramCount++;
        }
        
        if (share_mode && ['only_me', 'whitelist', 'all'].includes(share_mode)) {
            updateQuery += `, share_mode = $${paramCount}`;
            params.push(share_mode);
            paramCount++;
        }

        updateQuery += ` WHERE id = $${paramCount} RETURNING id, email, username, language, share_mode, created_at, updated_at`;
        params.push(req.user.id);

        const { rows } = await db.query(updateQuery, params);
        res.json({ user: rows[0] });
    } catch (error) {
        console.error('Update account error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/restrictions', authMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT ar.id as restriction_id, u.id as user_id, u.username, ar.created_at
             FROM allowed_recipients ar
             JOIN users u ON ar.recipient_id = u.id
             WHERE ar.owner_id = $1`,
            [req.user.id]
        );
        res.json({ recipients: rows });
    } catch (error) {
        console.error('Get restrictions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/restrictions', authMiddleware, async (req, res) => {
    let { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    const cleanUsername = username.trim().toLowerCase();

    try {
        const userRes = await db.query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const recipientId = userRes.rows[0].id;

        if (recipientId === req.user.id) {
            return res.status(400).json({ error: 'Cannot add yourself' });
        }

        const { rows } = await db.query(
            'INSERT INTO allowed_recipients (owner_id, recipient_id) VALUES ($1, $2) RETURNING id, created_at',
            [req.user.id, recipientId]
        );
        res.status(201).json({ restriction: rows[0] });
    } catch (error) {
        console.error('Add restriction error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Recipient already allowed' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/restrictions/:recipientId', authMiddleware, async (req, res) => {
    const { recipientId } = req.params;
    try {
        const { rowCount } = await db.query(
            'DELETE FROM allowed_recipients WHERE owner_id = $1 AND recipient_id = $2',
            [req.user.id, recipientId]
        );
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Restriction not found' });
        }
        res.json({ message: 'Restriction removed successfully' });
    } catch (error) {
        console.error('Remove restriction error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/search', authMiddleware, async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    try {
        const { rows } = await db.query(
            `SELECT id, username FROM users
             WHERE username ILIKE $1 AND id != $2
             LIMIT 10`,
            [`%${q}%`, req.user.id]
        );
        res.json({ users: rows });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
