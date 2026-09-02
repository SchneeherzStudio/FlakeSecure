/**
 * ============================================================================
 * FlakeSecure Mobile App - Zero-Knowledge Vault Synchronization Utility v2.4
 * ============================================================================
 * 
 * CHANGES IN v2.4:
 * - Diagnostic logging for key derivation debugging.
 * - syncVaultToServer always uses (userEmail || identifier) directly, no
 *   resolveUserDetails indirection, ensuring the same path as background sync.
 * - syncVaultFromServer exhaustively tries all candidate identifiers × rounds,
 *   with detailed per-candidate logging.
 * - Overwrite guard: empty local vault will not overwrite populated cloud vault.
 * ============================================================================
 */

export default {};

import * as ExpoCrypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { encryptCredentials, decryptCredentials } from './crypto';
import { getFullVaultExport, importFullVault, clearAllLocalVaultData } from './storage';
import { getVault, syncVault, getMe } from './api';

const DEFAULT_ROUNDS = 50;

export async function deriveVaultKey(password, identifier, rounds = DEFAULT_ROUNDS) {
  const cleanId = (identifier || '').trim().toLowerCase();
  let keyMaterial = `flakesecure_vault_salt_${cleanId}_${password}`;
  for (let i = 0; i < rounds; i++) {
    keyMaterial = await ExpoCrypto.digestStringAsync(
      ExpoCrypto.CryptoDigestAlgorithm.SHA256,
      keyMaterial + `_iter_${i}`
    );
  }
  return keyMaterial;
}

/**
 * Gather every identifier string we can find for this user.
 * Used by syncVaultFromServer to build an exhaustive candidate list.
 */
async function gatherAllIdentifiers(providedEmail, providedIdentifier) {
  const ids = [];

  if (providedEmail) ids.push(providedEmail);
  if (providedIdentifier) ids.push(providedIdentifier);

  // From local SecureStore
  try {
    const stored = await SecureStore.getItemAsync('auth_credentials');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.email) ids.push(parsed.email);
      if (parsed.identifier) ids.push(parsed.identifier);
      if (parsed.username) ids.push(parsed.username);
    }
  } catch (e) {}

  // From server /api/auth/me
  try {
    const me = await getMe();
    if (me && me.user) {
      if (me.user.email) ids.push(me.user.email);
      if (me.user.username) ids.push(me.user.username);
    }
  } catch (e) {}

  // Derive additional variants (username part of email, etc.)
  const extended = [];
  for (const id of ids) {
    extended.push(id);
    if (id.includes('@')) {
      extended.push(id.split('@')[0]);
    }
  }
  extended.push(''); // empty string fallback

  // Deduplicate, lowercase, trim
  return [...new Set(extended.map(c => c.trim().toLowerCase()).filter(c => typeof c === 'string'))];
}

export async function syncVaultToServer(password, identifier, userEmail = null, options = {}) {
  if (!password) return false;
  try {
    const fullData = await getFullVaultExport();
    const hasLocalContent =
      (fullData.credentials && fullData.credentials.length > 0) ||
      (fullData.totpItems && fullData.totpItems.length > 0) ||
      (fullData.categories && fullData.categories.length > 6);

    // Overwrite guard
    if (!hasLocalContent && !options.forceEmpty) {
      try {
        const existing = await getVault();
        if (existing && existing.vault && existing.vault.encrypted_blob) {
          console.log('[Vault] Local vault is empty; skipping server overwrite to protect cloud backup.');
          return true;
        }
      } catch (e) {}
    }

    // Determine primary identifier — keep it simple and deterministic:
    // Always prefer userEmail, then identifier, then stored email.
    let primaryId = (userEmail || identifier || '').trim().toLowerCase();
    if (!primaryId) {
      try {
        const stored = await SecureStore.getItemAsync('auth_credentials');
        if (stored) {
          const parsed = JSON.parse(stored);
          primaryId = (parsed.email || parsed.identifier || '').trim().toLowerCase();
        }
      } catch (e) {}
    }

    const vaultKeyHex = await deriveVaultKey(password, primaryId, DEFAULT_ROUNDS);
    console.log(`[Vault] Encrypting vault with primaryId="${primaryId}" rounds=${DEFAULT_ROUNDS} keyPrefix=${vaultKeyHex.substring(0, 8)}`);

    const encryptedPacket = await encryptCredentials(fullData, vaultKeyHex);
    const blobString = JSON.stringify(encryptedPacket);
    await syncVault(blobString, 1);
    console.log('[Vault] Vault successfully synced to server');
    return true;
  } catch (error) {
    console.log('[Vault] Sync to server error:', error.message);
    return false;
  }
}

export async function syncVaultFromServer(password, identifier, userEmail = null) {
  if (!password) return false;
  try {
    const res = await getVault();
    if (!res || !res.vault || !res.vault.encrypted_blob) {
      console.log('[Vault] No existing cloud vault found on server.');
      return false;
    }

    let encryptedPacket = res.vault.encrypted_blob;
    if (typeof encryptedPacket === 'string') {
      try { encryptedPacket = JSON.parse(encryptedPacket); } catch (e) {}
    }
    if (typeof encryptedPacket === 'string') {
      try { encryptedPacket = JSON.parse(encryptedPacket); } catch (e) {}
    }

    // Verify we have a proper {iv, data} structure
    if (!encryptedPacket || !encryptedPacket.iv || !encryptedPacket.data) {
      console.log('[Vault] encrypted_blob is not a valid {iv, data} packet. Type:', typeof encryptedPacket);
      if (encryptedPacket && typeof encryptedPacket === 'string') {
        console.log('[Vault] Blob preview (string):', encryptedPacket.substring(0, 200));
      }
      return false;
    }

    console.log(`[Vault] Blob structure: iv.length=${encryptedPacket.iv.length}, data.length=${encryptedPacket.data.length}`);
    console.log(`[Vault] iv[0..3]=[${encryptedPacket.iv.slice(0,4)}] data[0..3]=[${encryptedPacket.data.slice(0,4)}]`);

    const candidateIds = await gatherAllIdentifiers(userEmail, identifier);
    const roundAttempts = [DEFAULT_ROUNDS, 5000, 1000, 100, 10];

    console.log(`[Vault] Decrypt attempt: ${candidateIds.length} candidates × ${roundAttempts.length} round configs`);
    console.log(`[Vault] Candidates: ${JSON.stringify(candidateIds)}`);

    let validVaultData = null;
    let debugLogged = false;

    for (const rounds of roundAttempts) {
      for (const candId of candidateIds) {
        try {
          const vaultKeyHex = await deriveVaultKey(password, candId, rounds);
          const decryptedStr = await decryptCredentials(encryptedPacket, vaultKeyHex);

          if (!decryptedStr) {
            if (!debugLogged) {
              console.log(`[Vault] Candidate "${candId}" (${rounds}r): decryptedStr is null/empty`);
            }
            continue;
          }

          // Log the first candidate's decrypted output for diagnostics
          if (!debugLogged) {
            debugLogged = true;
            console.log(`[Vault] DIAG decrypted type=${typeof decryptedStr} len=${decryptedStr.length}`);
            console.log(`[Vault] DIAG first 300 chars: ${decryptedStr.substring(0, 300)}`);
            console.log(`[Vault] DIAG charCode[0..9]: ${Array.from(decryptedStr.substring(0, 10)).map(c => c.charCodeAt(0)).join(',')}`);
          }

          let parsed = null;
          try {
            parsed = typeof decryptedStr === 'string' ? JSON.parse(decryptedStr) : decryptedStr;
            if (typeof parsed === 'string') {
              parsed = JSON.parse(parsed);
            }
          } catch (jsonErr) {
            console.log(`[Vault] Candidate "${candId}" (${rounds}r): JSON parse error: ${jsonErr.message}`);
            continue;
          }

          if (
            parsed &&
            typeof parsed === 'object' &&
            (parsed.credentials !== undefined ||
              Array.isArray(parsed) ||
              parsed.categories !== undefined ||
              parsed.profile !== undefined ||
              parsed.totpItems !== undefined ||
              parsed.version !== undefined ||
              parsed.exportedAt !== undefined)
          ) {
            console.log(
              `[Vault] ✓ Decrypted successfully with candidate="${candId}" rounds=${rounds} keyPrefix=${vaultKeyHex.substring(0, 8)}`
            );
            validVaultData = parsed;
            break;
          }
        } catch (decErr) {
          // HMAC verification failed for this candidate — expected, try next
        }
      }
      if (validVaultData) break;
    }

    if (!validVaultData) {
      console.log('[Vault] ✗ Could not decrypt server vault with any candidate credentials.');
      // Log first 8 chars of the first candidate key for debugging
      if (candidateIds.length > 0) {
        const debugKey = await deriveVaultKey(password, candidateIds[0], DEFAULT_ROUNDS);
        console.log(`[Vault] Debug: first candidate="${candidateIds[0]}" rounds=${DEFAULT_ROUNDS} keyPrefix=${debugKey.substring(0, 8)}`);
      }
      return false;
    }

    await importFullVault(validVaultData);
    console.log('[Vault] Cloud vault restored successfully into local storage');
    return true;
  } catch (error) {
    console.log('[Vault] Sync from server error:', error.message);
    return false;
  }
}

export async function purgeLocalVault() {
  await clearAllLocalVaultData();
}
