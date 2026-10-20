/**
 * ============================================================================
 * FlakeSecure Server - Rate Limiting & Spend Cap Protection Middleware
 * ============================================================================
 */

const rateLimit = require('express-rate-limit');

// Custom key generator taking x-forwarded-for or socket IP
function getClientIp(req) {
  let ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.substring(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

// 1. Global API rate limiter (protects entire API from DDoS / flooding)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    error: 'Too many requests from this IP. Please try again after 1 minute.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// 2. Strict Authentication limiter (protects login, register, password reset from brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

// 3. OTP & Email Dispatch limiter (Spend cap protection: prevents draining email quota)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.MAX_OTP_PER_IP_HOURLY || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    error: 'Too many verification code requests. Please wait 15 minutes before requesting again.',
    code: 'EMAIL_SPEND_CAP_EXCEEDED'
  }
});

// 4. Relay session generation limiter
const relayLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    error: 'Too many relay session requests. Please slow down.',
    code: 'RELAY_RATE_LIMIT_EXCEEDED'
  }
});

// 5. Admin portal login limiter
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 admin login attempts
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    error: 'Too many admin login attempts. Account locked for 15 minutes.',
    code: 'ADMIN_LOCKED'
  }
});

// 6. User search limiter (prevents username enumeration scraping)
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 searches per 15 minutes per user/IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : getClientIp(req)),
  message: {
    error: 'Too many search requests. Please try again later.',
    code: 'SEARCH_RATE_LIMIT_EXCEEDED'
  }
});

// 7. HIBP pwned-range proxy limiter
const pwnedRangeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // max 60 range checks per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    error: 'Too many password range checks. Please slow down.',
    code: 'PWNED_RATE_LIMIT_EXCEEDED'
  }
});

// 8. Favicon proxy limiter (generous for vault rendering)
const faviconLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // max 300 favicon requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    error: 'Too many favicon requests. Please slow down.',
    code: 'FAVICON_RATE_LIMIT_EXCEEDED'
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  otpLimiter,
  relayLimiter,
  adminLoginLimiter,
  searchLimiter,
  pwnedRangeLimiter,
  faviconLimiter,
  getClientIp
};
