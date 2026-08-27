/**
 * ============================================================================
 * FlakeSecure Server - Login & Activity Logs Routes (/api/logs)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ENDPOINTS:
 * 
 * 1. GET /:
 *    - Retrieves paginated login and access activity logs for the authenticated user (sorted by created_at DESC).
 *    - Supports query parameters ?page= and ?limit=.
 * 
 * 2. DELETE /clear:
 *    - Clears all login and activity log entries for the authenticated user.
 * ============================================================================
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    try {
        const { rows } = await db.query(
            'SELECT * FROM login_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
            [req.user.id, limit, offset]
        );
        const countRes = await db.query('SELECT COUNT(*) FROM login_logs WHERE user_id = $1', [req.user.id]);
        const total = parseInt(countRes.rows[0].count);

        res.json({
            logs: rows,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/clear', authMiddleware, async (req, res) => {
    try {
        await db.query('DELETE FROM login_logs WHERE user_id = $1', [req.user.id]);
        res.json({ message: 'Logs cleared successfully' });
    } catch (error) {
        console.error('Clear logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
