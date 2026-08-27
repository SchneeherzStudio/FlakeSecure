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
 * 
 * 2. ENCRYPTION (encryptCredentials):
 *    - Generates a 16-byte CSPRNG IV via expo-crypto.
 *    - Encrypts JSON serialized objects using AES-256-CTR (aes-js).
 *    - Computes an HMAC-SHA256 authentication tag (Encrypt-then-MAC) over IV and ciphertext.
 *    - Returns wire payload packet { iv: number[], data: number[] }.
 * 
 * 3. DECRYPTION (decryptCredentials):
 *    - Extracts IV, ciphertext, and HMAC tag from the received payload.
 *    - Verifies HMAC-SHA256 integrity and decrypts data via AES-256-CTR.
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

export async function encryptCredentials(plainObj, keyHex) {
  const keyBytes = hexToBytes(keyHex);
  const ivBytes = await ExpoCrypto.getRandomBytesAsync(16);

  const textBytes = aesjs.utils.utf8.toBytes(JSON.stringify(plainObj));
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
  const keyBytes = hexToBytes(keyHex);
  const ivBytes = new Uint8Array(payloadObj.iv);
  const payloadData = new Uint8Array(payloadObj.data);

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

  return aesjs.utils.utf8.fromBytes(decryptedBytes);
}