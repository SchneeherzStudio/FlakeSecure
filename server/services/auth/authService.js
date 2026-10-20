/**
 * ============================================================================
 * FlakeSecure Authentication Service
 * ============================================================================
 * Handles user registration, login, logout, identity validation, OTP codes,
 * and 30-minute password resets.
 */

const express = require('express');
const authRoutes = require('../../routes/auth');
const otpRoutes = require('../../routes/otp');
const { authLimiter, otpLimiter } = require('../../middleware/rateLimit');

function createAuthService() {
  const router = express.Router();

  // Mount OTP endpoints with spend-cap / quota rate limiter
  router.use('/otp', otpLimiter, otpRoutes);

  // Mount Auth endpoints with strict brute-force rate limiter on login/register/reset/restore
  router.use('/auth', (req, res, next) => {
    if (['/login', '/register', '/forgot-password', '/reset-password', '/restore-account'].includes(req.path)) {
      return authLimiter(req, res, next);
    }
    next();
  }, authRoutes);

  return { router };
}

module.exports = { createAuthService };
