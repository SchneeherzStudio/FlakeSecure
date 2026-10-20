/**
 * ============================================================================
 * FlakeSecure Server - Security Utility Routes (/api/security)
 * ============================================================================
 *
 * 1. GET /pwned-range/:prefix:
 *    - Proxies Have I Been Pwned (HIBP) k-Anonymity SHA-1 5-char range queries.
 *    - Protects client IP addresses from direct exposure to HIBP/Cloudflare.
 *    - Uses 1-hour in-memory cache and Add-Padding: true.
 *    - Fails open with empty text/plain response if upstream is unreachable.
 * ============================================================================
 */

const express = require('express');
const { fetchPwnedRange } = require('../utils/passwordPolicy');
const { pwnedRangeLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/pwned-range/:prefix', pwnedRangeLimiter, async (req, res) => {
  const { prefix } = req.params;
  if (!prefix || !/^[A-F0-9]{5}$/i.test(prefix)) {
    return res.status(400).json({
      error: 'Invalid SHA-1 prefix. Must be 5 hexadecimal characters.',
      code: 'INVALID_PREFIX'
    });
  }

  try {
    const body = await fetchPwnedRange(prefix.toUpperCase());
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.type('text/plain').send(body);
  } catch (_) {
    // Fail-open on upstream HIBP timeout or outage
    res.setHeader('Cache-Control', 'no-store');
    res.type('text/plain').status(200).send('');
  }
});

module.exports = router;
