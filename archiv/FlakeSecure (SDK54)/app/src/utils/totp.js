/**
 * ============================================================================
 * FlakeSecure Mobile App - TOTP Authenticator Utility
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. BASE32 ENCODING & DECODING:
 *    - base32ToBytes(base32): Decodes standard Base32 strings (RFC 4648) into Uint8Array byte arrays.
 *    - bytesToBase32(bytes): Encodes Uint8Array byte arrays into RFC 4648 Base32 strings.
 * 
 * 2. SHA-1 / SHA-256 / SHA-512 HMAC CRYPTOGRAPHY:
 *    - hmac(algorithm, keyBytes, messageBytes): Computes HMAC-SHA1, HMAC-SHA256, or HMAC-SHA512 in pure JS.
 * 
 * 3. TOTP CODE GENERATION:
 *    - generateTOTP(secret, timeStep, digits, algorithm): Generates time-based one-time password (RFC 6238).
 *    - getRemainingSeconds(timeStep): Calculates seconds remaining until current code window rotates.
 * 
 * 4. URI PARSING:
 *    - parseOtpAuthUri(uri): Parses standard `otpauth://totp/...` URIs from scanned QR codes or links.
 * ============================================================================
 */

export default {};

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32ToBytes(base32) {
  if (!base32) return new Uint8Array(0);
  const clean = String(base32).toUpperCase().replace(/[\s=-]/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
  }
  return bytes;
}

export function bytesToBase32(bytes) {
  if (!bytes || bytes.length === 0) return '';
  let bits = '';
  for (let i = 0; i < bytes.length; i++) {
    bits += (bytes[i] & 0xff).toString(2).padStart(8, '0');
  }
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    out += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return out;
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
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

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

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(x, n) {
  return (x >>> n) | (x << (32 - n));
}

function sha256(bytes) {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLen = len * 8;
  const padLen = (((len + 8) >> 6) + 1) << 6;
  const msg = new Uint8Array(padLen);
  msg.set(bytes);
  msg[len] = 0x80;

  const view = new DataView(msg.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);

  for (let i = 0; i < padLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr32(w[t - 15], 7) ^ rotr32(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr32(w[t - 2], 17) ^ rotr32(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

const SHA512_K = [
  0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
  0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
  0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
  0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
  0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
  0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
  0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
  0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
  0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
  0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
  0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n,
];

const MASK_64 = 0xffffffffffffffffn;

function rotr64(x, n) {
  const bn = BigInt(n);
  return ((x >> bn) | ((x << (64n - bn)) & MASK_64)) & MASK_64;
}

function sha512(bytes) {
  let h0 = 0x6a09e667f3bcc908n;
  let h1 = 0xbb67ae8584caa73bn;
  let h2 = 0x3c6ef372fe94f82bn;
  let h3 = 0xa54ff53a5f1d36f1n;
  let h4 = 0x510e527fade682d1n;
  let h5 = 0x9b05688c2b3e6c1fn;
  let h6 = 0x1f83d9abfb41bd6bn;
  let h7 = 0x5be0cd19137e2179n;

  const len = bytes.length;
  const bitLen = BigInt(len) * 8n;
  const padLen = (((len + 16) >> 7) + 1) << 7;
  const msg = new Uint8Array(padLen);
  msg.set(bytes);
  msg[len] = 0x80;

  const view = new DataView(msg.buffer);
  view.setUint32(padLen - 8, Number((bitLen >> 32n) & 0xffffffffn), false);
  view.setUint32(padLen - 4, Number(bitLen & 0xffffffffn), false);

  const w = new Array(80).fill(0n);

  for (let i = 0; i < padLen; i += 128) {
    for (let t = 0; t < 16; t++) {
      const hi = BigInt(view.getUint32(i + t * 8, false));
      const lo = BigInt(view.getUint32(i + t * 8 + 4, false));
      w[t] = (hi << 32n) | lo;
    }
    for (let t = 16; t < 80; t++) {
      const s0 = rotr64(w[t - 15], 1) ^ rotr64(w[t - 15], 8) ^ (w[t - 15] >> 7n);
      const s1 = rotr64(w[t - 2], 19) ^ rotr64(w[t - 2], 61) ^ (w[t - 2] >> 6n);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) & MASK_64;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let t = 0; t < 80; t++) {
      const S1 = rotr64(e, 14) ^ rotr64(e, 18) ^ rotr64(e, 41);
      const ch = (e & f) ^ ((~e & MASK_64) & g);
      const temp1 = (h + S1 + ch + SHA512_K[t] + w[t]) & MASK_64;
      const S0 = rotr64(a, 28) ^ rotr64(a, 34) ^ rotr64(a, 39);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & MASK_64;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) & MASK_64;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) & MASK_64;
    }

    h0 = (h0 + a) & MASK_64;
    h1 = (h1 + b) & MASK_64;
    h2 = (h2 + c) & MASK_64;
    h3 = (h3 + d) & MASK_64;
    h4 = (h4 + e) & MASK_64;
    h5 = (h5 + f) & MASK_64;
    h6 = (h6 + g) & MASK_64;
    h7 = (h7 + h) & MASK_64;
  }

  const out = new Uint8Array(64);
  const outView = new DataView(out.buffer);
  const hs = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let idx = 0; idx < 8; idx++) {
    outView.setUint32(idx * 8, Number((hs[idx] >> 32n) & 0xffffffffn), false);
    outView.setUint32(idx * 8 + 4, Number(hs[idx] & 0xffffffffn), false);
  }
  return out;
}

export function hmac(algorithm, keyBytes, messageBytes) {
  const algo = String(algorithm || 'SHA1').toUpperCase().replace('-', '');
  const hashFn = algo === 'SHA512' ? sha512 : algo === 'SHA256' ? sha256 : sha1;
  const blockSize = algo === 'SHA512' ? 128 : 64;

  let k = new Uint8Array(blockSize);
  if (keyBytes.length > blockSize) {
    k.set(hashFn(keyBytes));
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
  const innerHash = hashFn(innerMsg);

  const outerMsg = new Uint8Array(blockSize + innerHash.length);
  outerMsg.set(oKeyPad);
  outerMsg.set(innerHash, blockSize);
  return hashFn(outerMsg);
}

export function generateTOTP(secret, timeStep = 30, digits = 6, algorithm = 'SHA1') {
  if (!secret) return '------';
  try {
    const keyBytes = base32ToBytes(secret);
    if (keyBytes.length === 0) return '------';

    const step = Number(timeStep) === 60 ? 60 : 30;
    const numDigits = Number(digits) === 8 ? 8 : 6;
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / step);

    const msg = new Uint8Array(8);
    const view = new DataView(msg.buffer);
    view.setUint32(0, Math.floor(counter / 0x100000000), false);
    view.setUint32(4, counter >>> 0, false);

    const hash = hmac(algorithm, keyBytes, msg);
    const offset = hash[hash.length - 1] & 0x0f;

    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = (binary % Math.pow(10, numDigits)).toString().padStart(numDigits, '0');
    return otp;
  } catch (e) {
    return '------';
  }
}

export function getRemainingSeconds(timeStep = 30) {
  const step = Number(timeStep) === 60 ? 60 : 30;
  const epoch = Math.floor(Date.now() / 1000);
  return step - (epoch % step);
}

export function parseOtpAuthUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (!trimmed.toLowerCase().startsWith('otpauth://')) return null;

  try {
    const withoutScheme = trimmed.slice('otpauth://'.length);
    const qIdx = withoutScheme.indexOf('?');
    const pathPart = qIdx !== -1 ? withoutScheme.slice(0, qIdx) : withoutScheme;
    const queryPart = qIdx !== -1 ? withoutScheme.slice(qIdx + 1) : '';

    const slashIdx = pathPart.indexOf('/');
    const type = (slashIdx !== -1 ? pathPart.slice(0, slashIdx) : pathPart).toLowerCase();
    const rawLabel = slashIdx !== -1 ? pathPart.slice(slashIdx + 1) : '';
    const label = decodeURIComponent(rawLabel.replace(/^\//, ''));

    const params = {};
    if (queryPart) {
      for (const pair of queryPart.split('&')) {
        const eq = pair.indexOf('=');
        if (eq === -1) continue;
        const k = decodeURIComponent(pair.slice(0, eq)).toLowerCase().trim();
        const v = decodeURIComponent(pair.slice(eq + 1)).trim();
        params[k] = v;
      }
    }

    let issuer = params.issuer || '';
    let account = label;

    if (label.includes(':')) {
      const colonIdx = label.indexOf(':');
      const prefix = label.slice(0, colonIdx).trim();
      const rest = label.slice(colonIdx + 1).trim();
      if (!issuer) issuer = prefix;
      account = rest;
    }

    const secret = (params.secret || '').replace(/\s+/g, '').toUpperCase();
    const rawDigits = parseInt(params.digits || '6', 10);
    const digits = rawDigits === 8 ? 8 : 6;
    const rawPeriod = parseInt(params.period || '30', 10);
    const period = rawPeriod === 60 ? 60 : 30;
    const rawAlgo = (params.algorithm || 'SHA1').toUpperCase().replace('-', '');
    const algorithm = ['SHA1', 'SHA256', 'SHA512'].includes(rawAlgo) ? rawAlgo : 'SHA1';

    return {
      type,
      issuer: issuer || account,
      account,
      secret,
      digits,
      period,
      algorithm,
    };
  } catch (e) {
    return null;
  }
}
