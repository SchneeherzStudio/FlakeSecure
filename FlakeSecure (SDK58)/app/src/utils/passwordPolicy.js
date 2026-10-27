/**
 * ============================================================================
 * FlakeSecure Mobile App - Password Policy & HIBP Breach Check Utility
 * ============================================================================
 */

import * as ExpoCrypto from 'expo-crypto';
import { getPasswordPolicy, fetchPwnedRange } from './api';

export const DEFAULT_PASSWORD_POLICY = {
  minLength: 12,
  passphraseLength: 16,
  minClasses: 3,
};

let cachedServerPolicy = null;

export async function loadPasswordPolicy() {
  if (cachedServerPolicy) return cachedServerPolicy;
  try {
    const res = await getPasswordPolicy();
    if (res && typeof res === 'object') {
      cachedServerPolicy = {
        minLength: Number(res.minLength) || DEFAULT_PASSWORD_POLICY.minLength,
        passphraseLength: Number(res.passphraseLength) || DEFAULT_PASSWORD_POLICY.passphraseLength,
        minClasses: Number(res.minClasses) || DEFAULT_PASSWORD_POLICY.minClasses,
      };
      return cachedServerPolicy;
    }
  } catch (e) {
    // Fallback to local default policy when offline
  }
  return DEFAULT_PASSWORD_POLICY;
}

const KEYBOARD_ROWS = [
  'qwertyuiop',
  'qwertzuiop',
  'asdfghjkl',
  'zxcvbnm',
  'yxcvbnm',
];

export function hasSequentialOrRepeated(password) {
  if (!password || password.length < 4) return false;
  // 4 or more identical consecutive characters (e.g. "aaaa", "1111")
  if (/(.)\1{3,}/.test(password)) {
    return true;
  }

  const lower = password.toLowerCase();
  for (let i = 0; i <= lower.length - 4; i++) {
    const sub = lower.slice(i, i + 4);
    const c0 = sub.charCodeAt(0);
    const c1 = sub.charCodeAt(1);
    const c2 = sub.charCodeAt(2);
    const c3 = sub.charCodeAt(3);

    const allAlpha = /^[a-z]{4}$/.test(sub);
    const allDigit = /^[0-9]{4}$/.test(sub);
    if (allAlpha || allDigit) {
      if (c1 - c0 === 1 && c2 - c1 === 1 && c3 - c2 === 1) return true;
      if (c1 - c0 === -1 && c2 - c1 === -1 && c3 - c2 === -1) return true;
    }

    for (const row of KEYBOARD_ROWS) {
      const rev = row.split('').reverse().join('');
      if (row.includes(sub) || rev.includes(sub)) {
        return true;
      }
    }
  }

  return false;
}

export function containsPersonalInfo(password, username = '', email = '') {
  if (!password) return false;
  const pw = password.toLowerCase();

  const cleanUser = (username || '').trim().toLowerCase();
  if (cleanUser.length >= 3 && pw.includes(cleanUser)) {
    return true;
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const emailLocal = (cleanEmail.split('@')[0] || '').trim();
  if (emailLocal.length >= 3 && pw.includes(emailLocal)) {
    return true;
  }

  return false;
}

export function evaluatePasswordPolicy(password, { username = '', email = '', policy = DEFAULT_PASSWORD_POLICY } = {}) {
  const pw = password || '';
  const minLength = policy?.minLength || DEFAULT_PASSWORD_POLICY.minLength;
  const passphraseLength = policy?.passphraseLength || DEFAULT_PASSWORD_POLICY.passphraseLength;
  const minClasses = policy?.minClasses || DEFAULT_PASSWORD_POLICY.minClasses;

  const hasMinLength = pw.length >= minLength;
  const hasNoWhitespace = pw.length > 0 && !/\s/.test(pw);

  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(pw);
  const classCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

  const isPassphrase = pw.length >= passphraseLength;
  const hasComplexity = isPassphrase || classCount >= minClasses;

  const hasNoPersonal = pw.length > 0 && !containsPersonalInfo(pw, username, email);
  const hasNoSequence = pw.length > 0 && !hasSequentialOrRepeated(pw);

  const isValid =
    hasMinLength &&
    hasNoWhitespace &&
    hasComplexity &&
    hasNoPersonal &&
    hasNoSequence;

  let strengthLevel = 0;
  let strengthKey = '';
  if (pw.length > 0) {
    if (!hasMinLength || !hasNoWhitespace || !hasNoPersonal || !hasNoSequence) {
      strengthLevel = 1;
      strengthKey = 'weak';
    } else if (!hasComplexity) {
      strengthLevel = 2;
      strengthKey = 'fair';
    } else if (pw.length >= passphraseLength || classCount >= 4) {
      strengthLevel = 4;
      strengthKey = 'strong';
    } else {
      strengthLevel = 3;
      strengthKey = 'good';
    }
  }

  return {
    minLength,
    passphraseLength,
    minClasses,
    hasMinLength,
    hasNoWhitespace,
    hasUpper,
    hasLower,
    hasDigit,
    hasSpecial,
    classCount,
    isPassphrase,
    hasComplexity,
    hasNoPersonal,
    hasNoSequence,
    isValid,
    strengthLevel,
    strengthKey,
  };
}

export async function checkPasswordPwned(password) {
  if (!password || password.length < 1) {
    return { pwned: false, count: 0 };
  }
  try {
    const sha1Hex = (
      await ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA1, password)
    ).toUpperCase();
    const prefix = sha1Hex.slice(0, 5);
    const suffix = sha1Hex.slice(5);

    const text = await fetchPwnedRange(prefix);
    if (!text) return { pwned: false, count: 0 };

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      const parts = line.split(':');
      if (parts.length < 2) continue;
      if (parts[0].trim().toUpperCase() === suffix) {
        const count = parseInt(parts[1].trim(), 10) || 0;
        return { pwned: count > 0, count };
      }
    }
    return { pwned: false, count: 0 };
  } catch (e) {
    // Gracefully skip if server/HIBP is unreachable
    return { pwned: false, count: 0, skipped: true };
  }
}

export function formatAuthServerError(err, t) {
  if (!err) return t('passwordPolicy.errRegistrationFailed');
  const code = err.code || '';
  if (code === 'USERNAME_TAKEN') {
    return t('passwordPolicy.errUsernameTaken');
  }
  if (code === 'WEAK_PASSWORD') {
    const errors = Array.isArray(err.errors) ? err.errors : [];
    if (errors.length > 0) {
      const mapped = errors.map((eCode) => {
        switch (eCode) {
          case 'MIN_LENGTH':
            return t('passwordPolicy.errMinLength');
          case 'NO_WHITESPACE':
            return t('passwordPolicy.errNoWhitespace');
          case 'COMPLEXITY':
            return t('passwordPolicy.errComplexity');
          case 'CONTAINS_PERSONAL':
            return t('passwordPolicy.errContainsPersonal');
          case 'SEQUENCE':
            return t('passwordPolicy.errSequence');
          case 'COMMON':
            return t('passwordPolicy.errCommon');
          case 'PWNED':
            return t('passwordPolicy.errPwned');
          default:
            return eCode;
        }
      });
      return mapped.join('\n');
    }
    return t('passwordPolicy.errWeakPassword');
  }
  if (code === 'REGISTRATION_FAILED') {
    return t('passwordPolicy.errRegistrationFailed');
  }
  return err.message || t('passwordPolicy.errRegistrationFailed');
}

export default {
  DEFAULT_PASSWORD_POLICY,
  loadPasswordPolicy,
  evaluatePasswordPolicy,
  checkPasswordPwned,
  formatAuthServerError,
};
