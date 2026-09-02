/**
 * ============================================================================
 * FlakeSecure Relay Server - Embed Router v2.0
 * ============================================================================
 * 
 * Provides cross-origin embeddable iframe endpoints and SDK serving.
 * Explicitly sets CSP frame-ancestors to allow embedding by third-party
 * websites while maintaining zero-knowledge encryption guarantees.
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const router = express.Router();

const EMBED_DIR = path.join(__dirname, '..', 'public', 'embed');

// Middleware to configure frame-friendly security headers for embed endpoints
router.use((req, res, next) => {
  // Allow all domains to embed FlakeSecure login widgets
  res.setHeader('Content-Security-Policy', "frame-ancestors *;");
  res.removeHeader('X-Frame-Options');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

/**
 * GET /embed
 * GET /embed/login
 * GET /embed/widget
 * Serves the standalone QR login iframe widget.
 */
router.get('/', (req, res) => {
  res.sendFile('widget.html', { root: EMBED_DIR });
});

router.get('/login', (req, res) => {
  res.sendFile('widget.html', { root: EMBED_DIR });
});

router.get('/widget', (req, res) => {
  res.sendFile('widget.html', { root: EMBED_DIR });
});

/**
 * GET /embed/demo
 * Interactive developer demo and integration testing sandbox.
 */
router.get('/demo', (req, res) => {
  res.sendFile('demo.html', { root: EMBED_DIR });
});

/**
 * GET /embed/docs
 * Redirects to developer documentation section.
 */
router.get('/docs', (req, res) => {
  res.redirect('/embed/demo#docs');
});

module.exports = router;
