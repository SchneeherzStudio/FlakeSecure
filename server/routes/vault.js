/**
 * ============================================================================
 * FlakeSecure Server - Vault Sync Routes (/api/vault)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ENDPOINTS:
 * 
 * 1. GET /sync:
 *    - Retrieves the encrypted vault blob, blob version, and last update timestamp for the authenticated user.
 *    - Returns null vault if no record exists.
 * 
 * 2. PUT /sync:
 *    - Upserts the encrypted vault blob and version for the authenticated user (INSERT ON CONFLICT UPDATE).
 *    - Returns the updated timestamp on success.
 * 
 * 3. DELETE /purge:
 *    - Permanently deletes the entire vault record for the authenticated user.
 * ============================================================================
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/sync', authMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT encrypted_blob, blob_version, updated_at FROM vault WHERE user_id = $1',
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.json({ vault: null });
        }

        res.json({ vault: rows[0] });
    } catch (error) {
        console.error('Vault get error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/sync', authMiddleware, async (req, res) => {
    const { encrypted_blob, blob_version } = req.body;

    if (!encrypted_blob || blob_version === undefined) {
        return res.status(400).json({ error: 'Encrypted blob and blob version are required' });
    }

    try {
        const { rows } = await db.query(
            `INSERT INTO vault (user_id, encrypted_blob, blob_version, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_id) DO UPDATE SET encrypted_blob = $2, blob_version = $3, updated_at = NOW()
             RETURNING updated_at`,
            [req.user.id, encrypted_blob, blob_version]
        );

        res.json({ success: true, updated_at: rows[0].updated_at });
    } catch (error) {
        console.error('Vault sync error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/purge', authMiddleware, async (req, res) => {
    try {
        await db.query('DELETE FROM vault WHERE user_id = $1', [req.user.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Vault purge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
