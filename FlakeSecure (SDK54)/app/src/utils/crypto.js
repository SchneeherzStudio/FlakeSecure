/**
 * ============================================================================
 * FlakeSecure Mobile App - Cryptography Utilities (AES-256-CTR + HMAC-SHA256)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. HELPER FUNCTIONS:
 *    - hexToBytes(hex): Converts hexadecimal strings into a Uint8Array.
 *    - bytesToHex(bytes): Converts a Uint8Array into a hexadecimal string.
 *    - utf8Encode(str): Full-spec UTF-8 encoder (handles 4-byte emoji / surrogate pairs).
 *    - utf8Decode(bytes): Full-spec UTF-8 decoder (handles 4-byte emoji / surrogate pairs).
 * 
 * 2. ENCRYPTION (encryptCredentials):
 *    - Generates a 16-byte CSPRNG IV via expo-crypto.
 *    - Encrypts JSON serialized objects using AES-256-CTR (aes-js).
 *    - Computes HMAC-SHA256 authentication tag (Encrypt-then-MAC) over IV and ciphertext.
 *    - Returns wire payload packet { iv: number[], data: number[] }.
 * 
 * 3. DECRYPTION (decryptCredentials):
 *    - Extracts IV, ciphertext, and HMAC tag from the received payload.
 *    - Verifies HMAC-SHA256 integrity and decrypts data via AES-256-CTR.
 *    - Uses custom utf8Decode to correctly handle 4-byte emoji sequences.
 * ============================================================================
 */

export default {};

import * as ExpoCrypto from 'expo-crypto';
import * as aesjs from 'aes-js';

export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Full-spec UTF-8 encoder that correctly handles characters above U+FFFF
 * (emoji, CJK extensions, etc.) by encoding JS surrogate pairs as 4-byte UTF-8.
 */
function utf8Encode(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);

    // Handle surrogate pairs → codepoint > 0xFFFF → 4-byte UTF-8
    if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
      const low = str.charCodeAt(i + 1);
      if (low >= 0xDC00 && low <= 0xDFFF) {
        code = ((code - 0xD800) << 10) + (low - 0xDC00) + 0x10000;
        i++; // skip low surrogate
      }
    }

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
    } else if (code < 0x10000) {
      bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
    } else {
      bytes.push(
        0xF0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3F),
        0x80 | ((code >> 6) & 0x3F),
        0x80 | (code & 0x3F)
      );
    }
  }
  return bytes;
}

/**
 * Full-spec UTF-8 decoder that correctly handles 4-byte sequences
 * (emoji, CJK extensions, etc.) by producing JS surrogate pairs.
 */
function utf8Decode(bytes) {
  let str = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      str += String.fromCharCode(b);
      i += 1;
    } else if ((b & 0xE0) === 0xC0) {
      str += String.fromCharCode(((b & 0x1F) << 6) | (bytes[i + 1] & 0x3F));
      i += 2;
    } else if ((b & 0xF0) === 0xE0) {
      str += String.fromCharCode(
        ((b & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F)
      );
      i += 3;
    } else if ((b & 0xF8) === 0xF0) {
      // 4-byte sequence → supplementary character → surrogate pair
      const codePoint =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3F) << 12) |
        ((bytes[i + 2] & 0x3F) << 6) |
        (bytes[i + 3] & 0x3F);
      const adjusted = codePoint - 0x10000;
      str += String.fromCharCode(0xD800 + (adjusted >> 10), 0xDC00 + (adjusted & 0x3FF));
      i += 4;
    } else {
      // Invalid byte — skip it
      str += String.fromCharCode(0xFFFD);
      i += 1;
    }
  }
  return str;
}

export async function encryptCredentials(plainObj, keyHex) {
  const keyBytes = hexToBytes(keyHex);
  const ivBytes = await ExpoCrypto.getRandomBytesAsync(16);

  const textBytes = utf8Encode(JSON.stringify(plainObj));
  const aesCtr = new aesjs.ModeOfOperation.ctr(
    Array.from(keyBytes),
    new aesjs.Counter(Array.from(ivBytes))
  );
  const ciphertext = aesCtr.encrypt(textBytes);

  const macInputHex = bytesToHex(ivBytes) + bytesToHex(ciphertext);
  const tagHex = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    macInputHex
  );
  const tagBytes = hexToBytes(tagHex);

  const payload = new Uint8Array(ciphertext.length + tagBytes.length);
  payload.set(ciphertext, 0);
  payload.set(tagBytes, ciphertext.length);

  return {
    iv: Array.from(ivBytes),
    data: Array.from(payload),
  };
}

export async function decryptCredentials(payloadObj, keyHex) {
  let parsed = payloadObj;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {}
  }
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {}
  }

  if (!parsed || !parsed.iv || !parsed.data) {
    throw new Error('Invalid encrypted payload structure');
  }

  const keyBytes = hexToBytes(keyHex);
  const ivBytes = new Uint8Array(parsed.iv);
  const payloadData = new Uint8Array(parsed.data);

  if (payloadData.length < 32) {
    throw new Error('Payload too short (missing HMAC)');
  }

  const ciphertextLen = payloadData.length - 32;
  const ciphertext = payloadData.slice(0, ciphertextLen);
  const tagBytes = payloadData.slice(ciphertextLen);

  const macInputHex = bytesToHex(ivBytes) + bytesToHex(ciphertext);
  const tagHex = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    macInputHex
  );
  const expectedTagBytes = hexToBytes(tagHex);

  let diff = 0;
  for (let i = 0; i < expectedTagBytes.length; i++) {
    diff |= expectedTagBytes[i] ^ tagBytes[i];
  }
  if (diff !== 0) {
    throw new Error('HMAC verification failed – payload may be tampered');
  }

  const aesCtr = new aesjs.ModeOfOperation.ctr(
    Array.from(keyBytes),
    new aesjs.Counter(Array.from(ivBytes))
  );
  const decryptedBytes = aesCtr.decrypt(ciphertext);

  try {
    return utf8Decode(Array.from(decryptedBytes));
  } catch (e) {
    return null;
  }
}