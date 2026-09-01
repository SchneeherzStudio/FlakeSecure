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
const nodemailer = require('nodemailer');
const db = require('../db');

const router = express.Router();

function generateOtpCode() {
    return crypto.randomInt(100000, 999999).toString();
}

function createTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: parseInt(process.env.SMTP_PORT) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

function buildOtpEmailHtml(code, purpose) {
    const purposeText = purpose === 'register'
        ? 'complete your FlakeSecure registration'
        : 'confirm your account deletion';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#090b14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#090b14;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px 30px;">
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <span style="font-size:48px;">❄️</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="color:#ffffff;font-size:22px;font-weight:700;padding-bottom:10px;">
              FlakeSecure Verification
            </td>
          </tr>
          <tr>
            <td align="center" style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;padding-bottom:30px;">
              Use the code below to ${purposeText}. This code expires in 10 minutes.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:30px;">
              <div style="display:inline-block;background:linear-gradient(135deg,#6391ff,#7c6aff);border-radius:12px;padding:16px 36px;font-size:32px;font-weight:700;color:#ffffff;letter-spacing:8px;">
                ${code}
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="color:rgba(255,255,255,0.35);font-size:13px;line-height:1.5;">
              If you didn't request this code, you can safely ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

router.post('/send', async (req, res) => {
    const { email, purpose } = req.body;

    if (!email || !purpose) {
        return res.status(400).json({ error: 'Email and purpose are required' });
    }

    if (!['register', 'delete'].includes(purpose)) {
        return res.status(400).json({ error: 'Purpose must be register or delete' });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
        const rateCheck = await db.query(
            "SELECT COUNT(*) FROM otp_codes WHERE email = $1 AND created_at > NOW() - INTERVAL '15 minutes'",
            [cleanEmail]
        );
        if (parseInt(rateCheck.rows[0].count) >= 3) {
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

        const transporter = createTransporter();
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: cleanEmail,
            subject: 'FlakeSecure Verification Code',
            html: buildOtpEmailHtml(code, purpose)
        });

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
