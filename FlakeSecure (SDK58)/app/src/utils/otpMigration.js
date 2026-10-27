/**
 * ============================================================================
 * FlakeSecure Mobile App - Google Authenticator Migration Decoder
 * ============================================================================
 *
 * Decodes `otpauth-migration://offline?data=<base64>` QR payloads exported by
 * Google Authenticator (Protobuf MigrationPayload schema).
 * ============================================================================
 */

import { bytesToBase32 } from './totp.js';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(b64Input) {
  if (!b64Input) return new Uint8Array(0);
  // Normalize URL-escaped and base64url characters
  let clean = decodeURIComponent(String(b64Input).trim())
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  while (clean.length % 4 !== 0) {
    clean += '=';
  }

  const out = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_CHARS.indexOf(clean[i]);
    const c1 = BASE64_CHARS.indexOf(clean[i + 1]);
    const c2 = clean[i + 2] === '=' ? -1 : BASE64_CHARS.indexOf(clean[i + 2]);
    const c3 = clean[i + 3] === '=' ? -1 : BASE64_CHARS.indexOf(clean[i + 3]);

    if (c0 === -1 || c1 === -1) continue;
    const triplet = (c0 << 18) | (c1 << 12) | ((c2 > -1 ? c2 : 0) << 6) | (c3 > -1 ? c3 : 0);
    out.push((triplet >> 16) & 0xff);
    if (c2 !== -1) out.push((triplet >> 8) & 0xff);
    if (c3 !== -1) out.push(triplet & 0xff);
  }
  return new Uint8Array(out);
}

function decodeUtf8(bytes) {
  try {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(bytes);
    }
  } catch {}
  let str = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      str += String.fromCharCode(b0);
    } else if ((b0 & 0xe0) === 0xc0 && i < bytes.length) {
      const b1 = bytes[i++] & 0x3f;
      str += String.fromCharCode(((b0 & 0x1f) << 6) | b1);
    } else if ((b0 & 0xf0) === 0xe0 && i + 1 < bytes.length) {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      str += String.fromCharCode(((b0 & 0x0f) << 12) | (b1 << 6) | b2);
    } else if ((b0 & 0xf8) === 0xf0 && i + 2 < bytes.length) {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      const b3 = bytes[i++] & 0x3f;
      const cp = (((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3) - 0x10000;
      str += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return str;
}

function readVarint(bytes, offset) {
  let result = 0n;
  let shift = 0n;
  let pos = offset;
  while (pos < bytes.length) {
    const byte = bytes[pos++];
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value: Number(result), nextOffset: pos };
    }
    shift += 7n;
    if (shift > 70n) throw new Error('Malformed varint');
  }
  throw new Error('Unexpected EOF reading varint');
}

function skipField(bytes, offset, wireType) {
  if (wireType === 0) {
    return readVarint(bytes, offset).nextOffset;
  }
  if (wireType === 1) {
    return offset + 8;
  }
  if (wireType === 2) {
    const { value: len, nextOffset } = readVarint(bytes, offset);
    return nextOffset + len;
  }
  if (wireType === 5) {
    return offset + 4;
  }
  throw new Error(`Unsupported wire type: ${wireType}`);
}

function parseOtpParameters(bytes) {
  let offset = 0;
  let secretBytes = new Uint8Array(0);
  let name = '';
  let issuer = '';
  let algorithmEnum = 1; // 1 = SHA1, 2 = SHA256, 3 = SHA512, 4 = MD5
  let digitsEnum = 1; // 1 = SIX, 2 = EIGHT
  let typeEnum = 2; // 1 = HOTP, 2 = TOTP
  let counter = 0;

  while (offset < bytes.length) {
    const { value: tag, nextOffset } = readVarint(bytes, offset);
    offset = nextOffset;
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x07;

    if (fieldNumber === 1 && wireType === 2) {
      const { value: len, nextOffset: dataStart } = readVarint(bytes, offset);
      secretBytes = bytes.slice(dataStart, dataStart + len);
      offset = dataStart + len;
    } else if (fieldNumber === 2 && wireType === 2) {
      const { value: len, nextOffset: dataStart } = readVarint(bytes, offset);
      name = decodeUtf8(bytes.slice(dataStart, dataStart + len));
      offset = dataStart + len;
    } else if (fieldNumber === 3 && wireType === 2) {
      const { value: len, nextOffset: dataStart } = readVarint(bytes, offset);
      issuer = decodeUtf8(bytes.slice(dataStart, dataStart + len));
      offset = dataStart + len;
    } else if (fieldNumber === 4 && wireType === 0) {
      const { value, nextOffset: next } = readVarint(bytes, offset);
      algorithmEnum = value;
      offset = next;
    } else if (fieldNumber === 5 && wireType === 0) {
      const { value, nextOffset: next } = readVarint(bytes, offset);
      digitsEnum = value;
      offset = next;
    } else if (fieldNumber === 6 && wireType === 0) {
      const { value, nextOffset: next } = readVarint(bytes, offset);
      typeEnum = value;
      offset = next;
    } else if (fieldNumber === 7 && wireType === 0) {
      const { value, nextOffset: next } = readVarint(bytes, offset);
      counter = value;
      offset = next;
    } else {
      offset = skipField(bytes, offset, wireType);
    }
  }

  let account = name || '';
  let resolvedIssuer = issuer || '';
  if (account.includes(':')) {
    const colonIdx = account.indexOf(':');
    const prefix = account.slice(0, colonIdx).trim();
    const rest = account.slice(colonIdx + 1).trim();
    if (!resolvedIssuer) resolvedIssuer = prefix;
    account = rest;
  }

  const secret = bytesToBase32(secretBytes);
  const algorithmMap = {
    0: 'SHA1',
    1: 'SHA1',
    2: 'SHA256',
    3: 'SHA512',
  };
  const algorithm = algorithmMap[algorithmEnum] || 'SHA1';
  const digits = digitsEnum === 2 ? 8 : 6;
  const type = typeEnum === 1 ? 'hotp' : 'totp';

  return {
    secret,
    issuer: resolvedIssuer || account || 'Account',
    account: account || resolvedIssuer || '',
    algorithm,
    digits,
    period: 30,
    type,
    counter,
  };
}

export function parseOtpMigrationUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (!trimmed.toLowerCase().startsWith('otpauth-migration://')) return null;

  try {
    const qIdx = trimmed.indexOf('?');
    if (qIdx === -1) return null;
    const query = trimmed.slice(qIdx + 1);
    let dataParam = null;
    for (const pair of query.split('&')) {
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const k = pair.slice(0, eq).trim().toLowerCase();
      const v = pair.slice(eq + 1).trim();
      if (k === 'data') {
        dataParam = v;
        break;
      }
    }
    if (!dataParam) return null;

    const bytes = base64ToBytes(dataParam);
    if (!bytes || bytes.length === 0) return null;

    let offset = 0;
    const items = [];
    let skippedHotpCount = 0;
    let version = 1;
    let batchSize = 1;
    let batchIndex = 0;
    let batchId = 0;

    while (offset < bytes.length) {
      const { value: tag, nextOffset } = readVarint(bytes, offset);
      offset = nextOffset;
      const fieldNumber = tag >>> 3;
      const wireType = tag & 0x07;

      if (fieldNumber === 1 && wireType === 2) {
        const { value: len, nextOffset: dataStart } = readVarint(bytes, offset);
        const paramBytes = bytes.slice(dataStart, dataStart + len);
        offset = dataStart + len;
        const parsed = parseOtpParameters(paramBytes);
        if (parsed.type === 'hotp') {
          skippedHotpCount += 1;
        } else if (parsed.secret) {
          items.push(parsed);
        }
      } else if (fieldNumber === 2 && wireType === 0) {
        const { value, nextOffset: next } = readVarint(bytes, offset);
        version = value;
        offset = next;
      } else if (fieldNumber === 3 && wireType === 0) {
        const { value, nextOffset: next } = readVarint(bytes, offset);
        batchSize = value || 1;
        offset = next;
      } else if (fieldNumber === 4 && wireType === 0) {
        const { value, nextOffset: next } = readVarint(bytes, offset);
        batchIndex = value || 0;
        offset = next;
      } else if (fieldNumber === 5 && wireType === 0) {
        const { value, nextOffset: next } = readVarint(bytes, offset);
        batchId = value || 0;
        offset = next;
      } else {
        offset = skipField(bytes, offset, wireType);
      }
    }

    return {
      items,
      skippedHotpCount,
      version,
      batchSize: Math.max(1, batchSize),
      batchIndex: Math.max(0, batchIndex),
      batchId,
    };
  } catch (e) {
    return null;
  }
}
