/**
 * ============================================================================
 * FlakeSecure Mobile App - Zero-Knowledge Vault Synchronization Utility v2.5
 * ============================================================================
 */

export default {};

import * as ExpoCrypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { encryptCredentials, decryptCredentials } from './crypto';
import {
  getFullVaultExport,
  importFullVault,
  clearAllLocalVaultData,
  markPendingVaultSync,
  clearPendingVaultSync,
  hasPendingVaultSync,
} from './storage';
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

async function gatherAllIdentifiers(providedEmail, providedIdentifier) {
  const ids = [];

  if (providedEmail) ids.push(providedEmail);
  if (providedIdentifier) ids.push(providedIdentifier);

  try {
    const stored = await SecureStore.getItemAsync('auth_credentials');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.email) ids.push(parsed.email);
      if (parsed.identifier) ids.push(parsed.identifier);
      if (parsed.username) ids.push(parsed.username);
    }
  } catch (e) {}

  try {
    const me = await getMe();
    if (me && me.user) {
      if (me.user.email) ids.push(me.user.email);
      if (me.user.username) ids.push(me.user.username);
    }
  } catch (e) {}

  const extended = [];
  for (const id of ids) {
    extended.push(id);
    if (id.includes('@')) {
      extended.push(id.split('@')[0]);
    }
  }
  extended.push('');

  return [
    ...new Set(
      extended.map((c) => c.trim().toLowerCase()).filter((c) => typeof c === 'string')
    ),
  ];
}

export async function syncVaultToServer(
  password,
  identifier,
  userEmail = null,
  options = {}
) {
  if (!password) return false;
  try {
    const fullData = await getFullVaultExport();
    const hasLocalContent =
      (fullData.credentials && fullData.credentials.length > 0) ||
      (fullData.bankAccounts && fullData.bankAccounts.length > 0) ||
      (fullData.cards && fullData.cards.length > 0) ||
      (fullData.codes && fullData.codes.length > 0) ||
      (fullData.totpItems && fullData.totpItems.length > 0) ||
      (fullData.categories && fullData.categories.length > 6);

    if (!hasLocalContent && !options.forceEmpty) {
      try {
        const existing = await getVault();
        if (existing && existing.vault && existing.vault.encrypted_blob) {
          return true;
        }
      } catch (e) {}
    }

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
    const encryptedPacket = await encryptCredentials(fullData, vaultKeyHex);
    const blobString = JSON.stringify(encryptedPacket);
    await syncVault(blobString, 1);
    await clearPendingVaultSync();
    return true;
  } catch (error) {
    await markPendingVaultSync();
    return false;
  }
}

export async function flushPendingVaultSync() {
  try {
    const pending = await hasPendingVaultSync();
    if (!pending) return false;
    const raw = await SecureStore.getItemAsync('auth_credentials');
    if (!raw) return false;
    const creds = JSON.parse(raw);
    if (!creds || !creds.password) return false;
    return await syncVaultToServer(creds.password, creds.identifier, creds.email);
  } catch {
    return false;
  }
}

export async function syncVaultFromServer(password, identifier, userEmail = null) {
  if (!password) return false;
  try {
    const res = await getVault();
    if (!res || !res.vault || !res.vault.encrypted_blob) {
      return false;
    }

    let encryptedPacket = res.vault.encrypted_blob;
    if (typeof encryptedPacket === 'string') {
      try {
        encryptedPacket = JSON.parse(encryptedPacket);
      } catch (e) {}
    }
    if (typeof encryptedPacket === 'string') {
      try {
        encryptedPacket = JSON.parse(encryptedPacket);
      } catch (e) {}
    }

    if (!encryptedPacket || !encryptedPacket.iv || !encryptedPacket.data) {
      return false;
    }

    const candidateIds = await gatherAllIdentifiers(userEmail, identifier);
    const roundAttempts = [DEFAULT_ROUNDS, 5000, 1000, 100, 10];

    let validVaultData = null;

    for (const rounds of roundAttempts) {
      for (const candId of candidateIds) {
        try {
          const vaultKeyHex = await deriveVaultKey(password, candId, rounds);
          const decryptedStr = await decryptCredentials(encryptedPacket, vaultKeyHex);

          if (!decryptedStr) continue;

          let parsed = null;
          try {
            parsed =
              typeof decryptedStr === 'string' ? JSON.parse(decryptedStr) : decryptedStr;
            if (typeof parsed === 'string') {
              parsed = JSON.parse(parsed);
            }
          } catch (jsonErr) {
            continue;
          }

          if (
            parsed &&
            typeof parsed === 'object' &&
            (parsed.credentials !== undefined ||
              parsed.bankAccounts !== undefined ||
              parsed.cards !== undefined ||
              parsed.codes !== undefined ||
              Array.isArray(parsed) ||
              parsed.categories !== undefined ||
              parsed.profile !== undefined ||
              parsed.totpItems !== undefined ||
              parsed.version !== undefined ||
              parsed.exportedAt !== undefined)
          ) {
            validVaultData = parsed;
            break;
          }
        } catch (decErr) {
          // HMAC verification failed for this candidate: expected, try next
        }
      }
      if (validVaultData) break;
    }

    if (!validVaultData) {
      return false;
    }

    await importFullVault(validVaultData);
    await clearPendingVaultSync();
    return true;
  } catch (error) {
    return false;
  }
}

export async function purgeLocalVault() {
  await clearAllLocalVaultData();
}
