/**
 * ============================================================================
 * FlakeSecure Mobile App - Zero-Knowledge Vault Synchronization Utility
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. KEY DERIVATION:
 *    - deriveVaultKey(password, identifier): Derives a 256-bit AES encryption key from the user's password and salt using iterative SHA-256 rounds (PBKDF2-equivalent).
 * 
 * 2. VAULT ENCRYPTION & UPLOAD:
 *    - syncVaultToServer(password, identifier): Exports local vault data, encrypts with derived key via AES-256-CTR + HMAC-SHA256, and uploads ciphertext to /api/vault/sync.
 * 
 * 3. VAULT DOWNLOAD & DECRYPTION:
 *    - syncVaultFromServer(password, identifier): Fetches encrypted vault blob from /api/vault/sync, decrypts with derived key, and populates local SecureStore.
 * 
 * 4. LOCAL DATA PURGE:
 *    - purgeLocalVault(): Clears all local credentials, TOTP secrets, and indices upon logout.
 * ============================================================================
 */

export default {};

import * as ExpoCrypto from 'expo-crypto';
import { encryptCredentials, decryptCredentials } from './crypto';
import { getFullVaultExport, importFullVault, clearAllLocalVaultData } from './storage';
import { getVault, syncVault } from './api';

export async function deriveVaultKey(password, identifier) {
  const cleanId = (identifier || '').trim().toLowerCase();
  let keyMaterial = `flakesecure_vault_salt_${cleanId}_${password}`;
  for (let i = 0; i < 5000; i++) {
    keyMaterial = await ExpoCrypto.digestStringAsync(
      ExpoCrypto.CryptoDigestAlgorithm.SHA256,
      keyMaterial + `_iter_${i}`
    );
  }
  return keyMaterial;
}

export async function syncVaultToServer(password, identifier) {
  try {
    const vaultKeyHex = await deriveVaultKey(password, identifier);
    const fullData = await getFullVaultExport();
    const encryptedPacket = await encryptCredentials(fullData, vaultKeyHex);
    const blobString = JSON.stringify(encryptedPacket);
    await syncVault(blobString, 1);
    return true;
  } catch (error) {
    console.log('[Vault] Sync to server error:', error.message);
    return false;
  }
}

export async function syncVaultFromServer(password, identifier) {
  try {
    const vaultKeyHex = await deriveVaultKey(password, identifier);
    const res = await getVault();
    if (!res || !res.vault || !res.vault.encrypted_blob) {
      return false;
    }

    const encryptedPacket = JSON.parse(res.vault.encrypted_blob);
    const decryptedJson = await decryptCredentials(encryptedPacket, vaultKeyHex);
    const vaultData = JSON.parse(decryptedJson);
    await importFullVault(vaultData);
    return true;
  } catch (error) {
    console.log('[Vault] Sync from server error:', error.message);
    return false;
  }
}

export async function purgeLocalVault() {
  await clearAllLocalVaultData();
}
