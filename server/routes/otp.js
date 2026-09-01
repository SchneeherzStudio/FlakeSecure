/**
 * ============================================================================
 * FlakeSecure Server - OTP Email Verification Routes (/api/otp)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ENDPOINTS:
 * 
 * 1. POST /send:
 *    - Generates a 6-digit OTP code for the given email and purpose (register/delete).
 *    - Hashes code with argon2, stores in otp_codes table with 10-minute expiry.
 *    - Deletes any existing OTP for the same email+purpose before inserting.
 *    - Rate limited to 3 requests per email per 15 minutes.
 *    - Sends a branded dark-theme HTML email via nodemailer (SMTP env vars).
 * 
 * 2. POST /verify:
 *    - Validates a submitted OTP code against the stored argon2 hash.
 *    - Tracks and limits verification attempts to 5 per code.
 *    - On success, deletes the OTP record and returns a signed JWT proof token (10-min expiry).
 * 
 * 3. HELPERS:
 *    - generateOtpCode(): Returns a cryptographically random 6-digit numeric string.
 *    - createTransporter(): Configures and returns a nodemailer SMTP transporter.
 *    - buildOtpEmailHtml(code, purpose): Builds the branded HTML email template.
 * ============================================================================
 */

const express = require('express');
const crypto = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { sendOtpEmail } = require('../utils/email');

const router = express.Router();

function generateOtpCode() {
    return crypto.randomInt(100000, 999999).toString();
}

router.post('/send', async (req, res) => {
    const { email, purpose, language } = req.body;

    if (!email || !purpose) {
        return res.status(400).json({ error: 'Email and purpose are required' });
    }

    if (!['register', 'delete'].includes(purpose)) {
        return res.status(400).json({ error: 'Purpose must be register or delete' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userLang = ['en', 'de', 'fr', 'es'].includes(language) ? language : 'en';

    try {
        const rateCheck = await db.query(
            "SELECT COUNT(*) FROM otp_codes WHERE email = $1 AND created_at > NOW() - INTERVAL '15 minutes'",
            [cleanEmail]
        );
        if (parseInt(rateCheck.rows[0].count, 10) >= 3) {
            return res.status(429).json({ error: 'Too many OTP requests. Please try again later.' });
        }

        await db.query(
            'DELETE FROM otp_codes WHERE email = $1 AND purpose = $2',
            [cleanEmail, purpose]
        );

        const code = generateOtpCode();
        const codeHash = await argon2.hash(code);

        await db.query(
            "INSERT INTO otp_codes (email, code_hash, purpose, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')",
            [cleanEmail, codeHash, purpose]
        );

        await sendOtpEmail(cleanEmail, code, purpose, userLang);

        res.json({ success: true, message: 'Verification code sent' });
    } catch (error) {
        console.error('OTP send error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/verify', async (req, res) => {
    const { email, code, purpose } = req.body;

    if (!email || !code || !purpose) {
        return res.status(400).json({ error: 'Email, code, and purpose are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
        const { rows } = await db.query(
            'SELECT id, code_hash, attempts FROM otp_codes WHERE email = $1 AND purpose = $2 AND expires_at > NOW()',
            [cleanEmail, purpose]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: 'No valid OTP found. It may have expired.' });
        }

        const otpRecord = rows[0];

        if (otpRecord.attempts >= 5) {
            await db.query('DELETE FROM otp_codes WHERE id = $1', [otpRecord.id]);
            return res.status(400).json({ error: 'Too many failed attempts. Please request a new code.' });
        }

        await db.query(
            'UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1',
            [otpRecord.id]
        );

        const valid = await argon2.verify(otpRecord.code_hash, code);
        if (!valid) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        await db.query('DELETE FROM otp_codes WHERE id = $1', [otpRecord.id]);

        const token = jwt.sign(
            { email: cleanEmail, purpose, verified: true },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        res.json({ verified: true, token });
    } catch (error) {
        console.error('OTP verify error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
