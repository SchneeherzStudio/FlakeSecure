/**
 * ============================================================================
 * FlakeSecure Mobile App - TOTP Authenticator Utility
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. BASE32 DECODING:
 *    - base32ToBytes(base32): Decodes standard Base32 strings (RFC 4648) into Uint8Array byte arrays.
 * 
 * 2. SHA-1 HMAC CRYPTOGRAPHY:
 *    - hmacSha1(keyBytes, messageBytes): Computes HMAC-SHA1 using pure JavaScript implementation.
 * 
 * 3. TOTP CODE GENERATION:
 *    - generateTOTP(secret, timeStep, digits): Generates time-based one-time password (RFC 6238, 30s rotation, 6 digits).
 *    - getRemainingSeconds(timeStep): Calculates seconds remaining until current code window rotates.
 * 
 * 4. URI PARSING:
 *    - parseOtpAuthUri(uri): Parses standard `otpauth://totp/...` URIs from scanned QR codes.
 * ============================================================================
 */

export default {};

function base32ToBytes(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/[\s=-]/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
  }
  return bytes;
}

function sha1(bytes) {
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const len = bytes.length;
  const bitLen = len * 8;
  const padLen = (((len + 8) >> 6) + 1) << 6;
  const msg = new Uint8Array(padLen);
  msg.set(bytes);
  msg[len] = 0x80;

  const view = new DataView(msg.buffer);
  view.setUint32(padLen - 4, bitLen, false);

  const w = new Uint32Array(80);

  for (let i = 0; i < padLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 80; t++) {
      const v = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16];
      w[t] = (v << 1) | (v >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let t = 0; t < 80; t++) {
      let f, k;
      if (t < 20) {
        f = (b & c) | ((~b) & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[t]) >>> 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  return out;
}

function hmacSha1(keyBytes, messageBytes) {
  const blockSize = 64;
  let k = new Uint8Array(blockSize);
  if (keyBytes.length > blockSize) {
    const hashed = sha1(keyBytes);
    k.set(hashed);
  } else {
    k.set(keyBytes);
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = k[i] ^ 0x5c;
    iKeyPad[i] = k[i] ^ 0x36;
  }

  const innerMsg = new Uint8Array(blockSize + messageBytes.length);
  innerMsg.set(iKeyPad);
  innerMsg.set(messageBytes, blockSize);
  const innerHash = sha1(innerMsg);

  const outerMsg = new Uint8Array(blockSize + 20);
  outerMsg.set(oKeyPad);
  outerMsg.set(innerHash, blockSize);
  return sha1(outerMsg);
}

export function generateTOTP(secret, timeStep = 30, digits = 6) {
  if (!secret) return '------';
  try {
    const keyBytes = base32ToBytes(secret);
    if (keyBytes.length === 0) return '------';

    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / timeStep);

    const msg = new Uint8Array(8);
    const view = new DataView(msg.buffer);
    view.setUint32(4, counter, false);

    const hash = hmacSha1(keyBytes, msg);
    const offset = hash[hash.length - 1] & 0x0f;

    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = (binary % Math.pow(10, digits)).toString().padStart(digits, '0');
    return otp;
  } catch (e) {
    return '------';
  }
}

export function getRemainingSeconds(timeStep = 30) {
  const epoch = Math.floor(Date.now() / 1000);
  return timeStep - (epoch % timeStep);
}

export function parseOtpAuthUri(uri) {
  if (!uri || !uri.startsWith('otpauth://')) return null;
  try {
    const url = new URL(uri);
    const type = url.host;
    const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
    let issuer = url.searchParams.get('issuer') || '';
    let account = label;

    if (label.includes(':')) {
      const parts = label.split(':');
      if (!issuer) issuer = parts[0].trim();
      account = parts[1].trim();
    }

    const secret = url.searchParams.get('secret') || '';
    const digits = parseInt(url.searchParams.get('digits') || '6', 10);
    const period = parseInt(url.searchParams.get('period') || '30', 10);

    return {
      type,
      issuer: issuer || account,
      account,
      secret,
      digits,
      period,
    };
  } catch (e) {
    return null;
  }
}
