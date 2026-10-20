/**
 * ============================================================================
 * FlakeSecure Server - Password Policy & HIBP k-Anonymity Validator
 * ============================================================================
 *
 * Enforces strict password security rules:
 * - MIN_LENGTH: Minimum 12 characters
 * - NO_WHITESPACE: No spaces or whitespace characters
 * - COMPLEXITY: At least 3 of 4 character classes (upper, lower, digit, special)
 *               unless passphrase length >= 16 characters
 * - CONTAINS_PERSONAL: Cannot contain username or email local-part (if >= 3 chars)
 * - SEQUENCE: No 4+ identical consecutive characters or 4+ sequential letters/digits
 * - COMMON: Not in commonPasswords.txt list (case-insensitive)
 * - PWNED: Not present in Have I Been Pwned (HIBP) k-Anonymity range API
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PASSWORD_POLICY = {
  minLength: 12,
  passphraseLength: 16,
  minClasses: 3
};

// Load common passwords list once into memory Set
const commonPasswordsSet = new Set();
try {
  const listPath = path.join(__dirname, 'commonPasswords.txt');
  if (fs.existsSync(listPath)) {
    const raw = fs.readFileSync(listPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const cleaned = line.trim().toLowerCase();
      if (cleaned && !cleaned.startsWith('#')) {
        commonPasswordsSet.add(cleaned);
      }
    }
  }
} catch (err) {
  console.warn('[PasswordPolicy] Could not load commonPasswords.txt:', err.message);
}

// In-memory cache for HIBP 5-char SHA-1 prefix range responses (TTL: 1 hour)
const HIBP_CACHE_TTL_MS = 60 * 60 * 1000;
const HIBP_MAX_CACHE_ENTRIES = 5000;
const hibpRangeCache = new Map();

function pruneHibpCache() {
  const now = Date.now();
  for (const [k, v] of hibpRangeCache.entries()) {
    if (v.expiresAt <= now) {
      hibpRangeCache.delete(k);
    }
  }
  while (hibpRangeCache.size >= HIBP_MAX_CACHE_ENTRIES) {
    const oldestKey = hibpRangeCache.keys().next().value;
    if (!oldestKey) break;
    hibpRangeCache.delete(oldestKey);
  }
}

/**
 * Fetches the raw HIBP range body for a 5-char uppercase hex prefix.
 * Uses 1-hour in-memory cache and 3-second timeout with Add-Padding: true.
 */
async function fetchPwnedRange(prefix) {
  const cleanPrefix = String(prefix || '').trim().toUpperCase();
  if (!/^[A-F0-9]{5}$/.test(cleanPrefix)) {
    throw new Error('Invalid SHA-1 prefix');
  }

  const now = Date.now();
  const cached = hibpRangeCache.get(cleanPrefix);
  if (cached && cached.expiresAt > now) {
    return cached.body;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${cleanPrefix}`, {
      method: 'GET',
      headers: {
        'Add-Padding': 'true',
        'User-Agent': 'FlakeSecure-PasswordCheck/2.0'
      },
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`HIBP HTTP ${res.status}`);
    }

    const body = await res.text();
    pruneHibpCache();
    hibpRangeCache.set(cleanPrefix, {
      body,
      expiresAt: now + HIBP_CACHE_TTL_MS
    });
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Checks if a password appears in HIBP breaches using k-Anonymity.
 * Fails open (returns false) on network error or timeout.
 */
async function isPwned(password) {
  if (!password || typeof password !== 'string') return false;
  try {
    const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const body = await fetchPwnedRange(prefix);
    const lines = body.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const lineSuffix = line.slice(0, colonIdx).trim().toUpperCase();
      if (lineSuffix === suffix) {
        const count = parseInt(line.slice(colonIdx + 1).trim(), 10);
        return Number.isFinite(count) && count > 0;
      }
    }
    return false;
  } catch (_) {
    // Fail-open on network errors or timeouts
    return false;
  }
}

/**
 * Checks for 4+ identical consecutive characters (e.g. "aaaa", "1111")
 * or 4+ ascending/descending consecutive letters or digits (e.g. "abcd", "4321").
 */
function hasSequenceOrRepeat(password) {
  if (/(.)\1{3,}/.test(password)) {
    return true;
  }
  const lower = password.toLowerCase();
  for (let i = 0; i <= lower.length - 4; i++) {
    const c0 = lower.charCodeAt(i);
    const c1 = lower.charCodeAt(i + 1);
    const c2 = lower.charCodeAt(i + 2);
    const c3 = lower.charCodeAt(i + 3);

    const isAllLowerAlpha =
      c0 >= 97 && c0 <= 122 &&
      c1 >= 97 && c1 <= 122 &&
      c2 >= 97 && c2 <= 122 &&
      c3 >= 97 && c3 <= 122;

    const isAllDigits =
      c0 >= 48 && c0 <= 57 &&
      c1 >= 48 && c1 <= 57 &&
      c2 >= 48 && c2 <= 57 &&
      c3 >= 48 && c3 <= 57;

    if (isAllLowerAlpha || isAllDigits) {
      const d1 = c1 - c0;
      const d2 = c2 - c1;
      const d3 = c3 - c2;
      if ((d1 === 1 && d2 === 1 && d3 === 1) || (d1 === -1 && d2 === -1 && d3 === -1)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Validates a password against all synchronous policy rules and async HIBP check.
 * @param {string} password
 * @param {{ username?: string, email?: string }} context
 * @returns {Promise<{ ok: boolean, errors: string[] }>}
 */
async function validatePassword(password, { username, email } = {}) {
  const errors = [];
  const pwd = typeof password === 'string' ? password : '';

  if (pwd.length < PASSWORD_POLICY.minLength) {
    errors.push('MIN_LENGTH');
  }

  if (/\s/.test(pwd)) {
    errors.push('NO_WHITESPACE');
  }

  if (pwd.length < PASSWORD_POLICY.passphraseLength) {
    let classes = 0;
    if (/[A-Z]/.test(pwd)) classes++;
    if (/[a-z]/.test(pwd)) classes++;
    if (/[0-9]/.test(pwd)) classes++;
    if (/[^A-Za-z0-9\s]/.test(pwd)) classes++;

    if (classes < PASSWORD_POLICY.minClasses) {
      errors.push('COMPLEXITY');
    }
  }

  const lowerPwd = pwd.toLowerCase();
  let containsPersonal = false;

  if (username && typeof username === 'string') {
    const cleanUser = username.trim().toLowerCase();
    if (cleanUser.length >= 3 && lowerPwd.includes(cleanUser)) {
      containsPersonal = true;
    }
  }

  if (!containsPersonal && email && typeof email === 'string') {
    const localPart = email.trim().split('@')[0].toLowerCase();
    if (localPart.length >= 3 && lowerPwd.includes(localPart)) {
      containsPersonal = true;
    }
  }

  if (containsPersonal) {
    errors.push('CONTAINS_PERSONAL');
  }

  if (pwd.length > 0 && hasSequenceOrRepeat(pwd)) {
    errors.push('SEQUENCE');
  }

  if (pwd.length > 0 && commonPasswordsSet.has(lowerPwd)) {
    errors.push('COMMON');
  }

  if (pwd.length > 0) {
    const pwned = await isPwned(pwd);
    if (pwned) {
      errors.push('PWNED');
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

const ERROR_MESSAGES = {
  MIN_LENGTH: 'Password must be at least 12 characters long.',
  NO_WHITESPACE: 'Password cannot contain spaces or whitespace characters.',
  COMPLEXITY: 'Password must include at least 3 of 4 character types (uppercase, lowercase, number, special character) or be at least 16 characters long.',
  CONTAINS_PERSONAL: 'Password must not contain your username or email address.',
  SEQUENCE: 'Password must not contain 4 or more repeated or sequential characters (e.g. aaaa, abcd, 1234).',
  COMMON: 'This password is too common and easily guessed. Please choose a stronger password.',
  PWNED: 'This password has appeared in known data breaches. Please choose a different password.'
};

function formatPasswordErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return 'Password does not meet security requirements.';
  }
  return errors.map(code => ERROR_MESSAGES[code] || code).join(' ');
}

module.exports = {
  PASSWORD_POLICY,
  validatePassword,
  isPwned,
  fetchPwnedRange,
  formatPasswordErrors
};
