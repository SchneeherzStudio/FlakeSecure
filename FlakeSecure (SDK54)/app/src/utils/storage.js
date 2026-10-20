/**
 * ============================================================================
 * FlakeSecure Mobile App - Encrypted Local Storage & Category Store v2.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. PROFILE PRESETS:
 *    - getDefaultProfile(): Loads default registration autofill data.
 *    - saveDefaultProfile(profile): Persists default profile data in SecureStore.
 * 
 * 2. CATEGORY MANAGEMENT:
 *    - getCategories(): Retrieves all categories (default + custom).
 *    - saveCategory(category): Creates or updates a category with custom name and icon.
 *    - deleteCategory(categoryId): Deletes a category.
 * 
 * 3. CREDENTIALS STORAGE (SecureStore):
 *    - getCredentialsForDomain(domain): Retrieves credentials and handles auto-deletion on expiry.
 *    - saveCredentials(domain, username, password, options): Persists credentials with category, hidden flag, and expiry date.
 *    - deleteCredentials(domain): Deletes credentials and updates domain index.
 *    - getAllCredentials(): Retrieves all stored credentials filtered against expired entries.
 *    - findCredentialsForDomain(domain): Finds credentials with subdomain hierarchy fallback (e.g. auth.ea.com -> ea.com).
 * 
 * 4. TOTP AUTHENTICATOR ITEMS STORAGE:
 *    - getTotpItems(): Retrieves all saved TOTP secrets.
 *    - saveTotpItem(item): Persists a new or updated TOTP secret entry.
 *    - deleteTotpItem(id): Removes a TOTP secret.
 * 
 * 5. VAULT IMPORT / EXPORT & LOCAL WIPE:
 *    - getFullVaultExport(): Exports complete credentials (including plaintext passwords), categories, profile, and TOTP items for encrypted cloud sync.
 *    - importFullVault(vaultObj): Populates local storage from decrypted vault payload.
 *    - clearAllLocalVaultData(): Wipes all credentials, TOTP secrets, and domain indices upon account logout.
 * ============================================================================
 */

export default {};

import * as SecureStore from 'expo-secure-store';

const CREDENTIALS_KEY = 'flakesecure_credentials_v1';
const INDEX_KEY = 'flakesecure_index_v1';
const CATEGORIES_KEY = 'flakesecure_categories_v1';
const DEFAULT_PROFILE_KEY = 'flakesecure_default_profile_v1';
const TOTP_ITEMS_KEY = 'flakesecure_totp_items_v1';
const NOTE_KEY_PREFIX = 'flakesecure_note_';

function getNoteStorageKey(credId) {
  return `${NOTE_KEY_PREFIX}${String(credId || '').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export async function getNote(credId) {
  if (!credId) return '';
  try {
    const val = await SecureStore.getItemAsync(getNoteStorageKey(credId));
    return val || '';
  } catch {
    return '';
  }
}

export const DEFAULT_CATEGORIES = [
  { id: 'personal', name: 'Personal', icon: 'user', isDefault: true },
  { id: 'work', name: 'Work', icon: 'briefcase', isDefault: true },
  { id: 'finance', name: 'Finance', icon: 'card', isDefault: true },
  { id: 'social', name: 'Social', icon: 'message', isDefault: true },
  { id: 'entertainment', name: 'Entertainment', icon: 'code', isDefault: true },
  { id: 'other', name: 'Other', icon: 'folder', isDefault: true },
];

export async function getDefaultProfile() {
  try {
    const raw = await SecureStore.getItemAsync(DEFAULT_PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { email: '', username: '', firstName: '', lastName: '', phone: '' };
}

export async function saveDefaultProfile(profile) {
  await SecureStore.setItemAsync(DEFAULT_PROFILE_KEY, JSON.stringify(profile));
  triggerBackgroundVaultSync();
  return profile;
}

export async function getCategories() {
  try {
    const raw = await SecureStore.getItemAsync(CATEGORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    await SecureStore.setItemAsync(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export async function saveCategory(category) {
  const categories = await getCategories();
  const id = category.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const cleanName = category.name.trim();
  const icon = category.icon || 'tag';

  const existingIdx = categories.findIndex(c => c.id === id || c.name.toLowerCase() === cleanName.toLowerCase());
  if (existingIdx >= 0) {
    categories[existingIdx] = { ...categories[existingIdx], name: cleanName, icon };
  } else {
    categories.push({ id, name: cleanName, icon, isDefault: false });
  }

  await SecureStore.setItemAsync(CATEGORIES_KEY, JSON.stringify(categories));
  triggerBackgroundVaultSync();
  return categories;
}

export async function deleteCategory(categoryId) {
  let categories = await getCategories();
  categories = categories.filter(c => c.id !== categoryId);
  await SecureStore.setItemAsync(CATEGORIES_KEY, JSON.stringify(categories));
  triggerBackgroundVaultSync();
  return categories;
}

async function getDomainIndex() {
  try {
    const raw = await SecureStore.getItemAsync(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveDomainIndex(domains) {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(domains));
}

function normalizeCredentialsArray(rawParsed, domain) {
  if (!rawParsed) return [];
  if (Array.isArray(rawParsed)) {
    return rawParsed.map((item, idx) => ({
      id: item.id || `cred_${domain.replace(/\./g, '_')}_${idx}_${Date.now()}`,
      name: item.name || '',
      username: item.username || '',
      password: item.password || '',
      updatedAt: item.updatedAt || new Date().toISOString(),
      category: item.category || null,
      hidden: item.hidden || false,
      expiresAt: item.expiresAt || null,
      sharedBy: item.sharedBy || null,
      hasNote: !!item.hasNote,
    }));
  }
  return [{
    id: rawParsed.id || `cred_${domain.replace(/\./g, '_')}_legacy`,
    name: rawParsed.name || '',
    username: rawParsed.username || '',
    password: rawParsed.password || '',
    updatedAt: rawParsed.updatedAt || new Date().toISOString(),
    category: rawParsed.category || null,
    hidden: rawParsed.hidden || false,
    expiresAt: rawParsed.expiresAt || null,
    sharedBy: rawParsed.sharedBy || null,
    hasNote: !!rawParsed.hasNote,
  }];
}

export async function getCredentialsForDomain(domain) {
  try {
    const key = `${CREDENTIALS_KEY}_${domain.replace(/\./g, '_')}`;
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return [];
    const accounts = normalizeCredentialsArray(JSON.parse(raw), domain);
    const now = new Date();
    const valid = accounts.filter(a => !a.expiresAt || new Date(a.expiresAt) >= now);
    if (valid.length !== accounts.length) {
      for (const acc of accounts) {
        if (!valid.some(v => v.id === acc.id)) {
          await SecureStore.deleteItemAsync(getNoteStorageKey(acc.id)).catch(() => {});
        }
      }
      if (valid.length === 0) {
        await deleteCredentials(domain);
        return [];
      } else {
        await SecureStore.setItemAsync(key, JSON.stringify(valid));
      }
    }
    if (valid.length > 0) {
      valid.username = valid[0].username;
      valid.password = valid[0].password;
      valid.name = valid[0].name;
      valid.id = valid[0].id;
      valid.category = valid[0].category;
      valid.hidden = valid[0].hidden;
      valid.expiresAt = valid[0].expiresAt;
      valid.sharedBy = valid[0].sharedBy;
      valid.hasNote = !!valid[0].hasNote;
      valid.updatedAt = valid[0].updatedAt;
    }
    return valid;
  } catch {
    return [];
  }
}

export async function saveCredentials(domain, username, password, options = {}) {
  const key = `${CREDENTIALS_KEY}_${domain.replace(/\./g, '_')}`;
  const accounts = await getCredentialsForDomain(domain);
  const now = new Date().toISOString();

  const credId = options.id || null;
  const name = options.name !== undefined ? (options.name || '').trim() : '';
  const cleanUsername = (username || '').trim();

  let foundIndex = -1;
  if (credId) {
    foundIndex = accounts.findIndex(a => a.id === credId);
  } else if (cleanUsername) {
    foundIndex = accounts.findIndex(a => a.username.toLowerCase() === cleanUsername.toLowerCase() && (a.name || '') === name);
    if (foundIndex === -1 && !name) {
      foundIndex = accounts.findIndex(a => a.username.toLowerCase() === cleanUsername.toLowerCase());
    }
  }

  const existing = foundIndex >= 0 ? accounts[foundIndex] : null;
  const id = credId || existing?.id || `cred_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  let hasNote = !!existing?.hasNote;
  if (options.notes !== undefined) {
    const cleanNote = String(options.notes || '').slice(0, 1000);
    if (cleanNote.trim().length > 0) {
      await SecureStore.setItemAsync(getNoteStorageKey(id), cleanNote);
      hasNote = true;
    } else {
      await SecureStore.deleteItemAsync(getNoteStorageKey(id)).catch(() => {});
      hasNote = false;
    }
  }

  const updatedItem = {
    id,
    name: options.name !== undefined ? name : (existing?.name || ''),
    username: cleanUsername || existing?.username || '',
    password: (options.hidden && !password && existing) ? existing.password : password,
    updatedAt: now,
    category: options.category !== undefined ? options.category : (existing?.category || null),
    hidden: options.hidden !== undefined ? !!options.hidden : (existing?.hidden || false),
    expiresAt: options.expiresAt !== undefined ? options.expiresAt : (existing?.expiresAt || null),
    sharedBy: options.sharedBy !== undefined ? options.sharedBy : (existing?.sharedBy || null),
    hasNote,
  };

  if (foundIndex >= 0) {
    accounts[foundIndex] = updatedItem;
  } else {
    accounts.push(updatedItem);
  }

  await SecureStore.setItemAsync(key, JSON.stringify(accounts));

  const index = await getDomainIndex();
  if (!index.includes(domain)) {
    index.push(domain);
    await saveDomainIndex(index);
  }
  triggerBackgroundVaultSync();
  return updatedItem;
}

export async function deleteCredentials(domain, credId = null) {
  const key = `${CREDENTIALS_KEY}_${domain.replace(/\./g, '_')}`;

  if (credId) {
    await SecureStore.deleteItemAsync(getNoteStorageKey(credId)).catch(() => {});
    const raw = await SecureStore.getItemAsync(key);
    if (raw) {
      let accounts = normalizeCredentialsArray(JSON.parse(raw), domain);
      accounts = accounts.filter(a => a.id !== credId);
      if (accounts.length > 0) {
        await SecureStore.setItemAsync(key, JSON.stringify(accounts));
        triggerBackgroundVaultSync();
        return;
      }
    }
  } else {
    try {
      const raw = await SecureStore.getItemAsync(key);
      if (raw) {
        const accounts = normalizeCredentialsArray(JSON.parse(raw), domain);
        for (const acc of accounts) {
          if (acc.id) {
            await SecureStore.deleteItemAsync(getNoteStorageKey(acc.id)).catch(() => {});
          }
        }
      }
    } catch {}
  }

  await SecureStore.deleteItemAsync(key);
  const index = await getDomainIndex();
  const updated = index.filter(d => d !== domain);
  await saveDomainIndex(updated);
  triggerBackgroundVaultSync();
}

export async function getAllCredentials() {
  const index = await getDomainIndex();
  const results = [];

  for (const domain of index) {
    const accounts = await getCredentialsForDomain(domain);
    for (const cred of accounts) {
      results.push({
        id: cred.id,
        domain,
        name: cred.name || '',
        username: cred.username,
        updatedAt: cred.updatedAt,
        category: cred.category || null,
        hidden: cred.hidden || false,
        expiresAt: cred.expiresAt || null,
        sharedBy: cred.sharedBy || null,
        hasNote: !!cred.hasNote,
      });
    }
  }

  return results;
}

export async function findCredentialsForDomain(domain) {
  let accounts = await getCredentialsForDomain(domain);
  let resolvedDomain = domain;

  if (accounts.length === 0) {
    const parts = domain.split('.');
    if (parts.length > 2) {
      const rootDomain = parts.slice(-2).join('.');
      accounts = await getCredentialsForDomain(rootDomain);
      if (accounts.length > 0) {
        resolvedDomain = rootDomain;
      }
    }
  }

  if (accounts.length === 0) return null;

  const primary = accounts[0];
  return {
    domain: resolvedDomain,
    accounts,
    id: primary.id,
    name: primary.name || '',
    username: primary.username,
    password: primary.password,
    category: primary.category,
    hidden: primary.hidden,
    expiresAt: primary.expiresAt,
    sharedBy: primary.sharedBy,
    hasNote: !!primary.hasNote,
    updatedAt: primary.updatedAt,
  };
}

export async function getTotpItems() {
  try {
    const raw = await SecureStore.getItemAsync(TOTP_ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveTotpItem(item) {
  const items = await getTotpItems();
  const id = item.id || `totp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const existingIdx = items.findIndex(t => t.id === id);
  const existing = existingIdx >= 0 ? items[existingIdx] : null;

  const cleanIssuer = item.issuer !== undefined ? (item.issuer || '').trim() : (existing?.issuer || '');
  const cleanAccount = item.account !== undefined ? (item.account || '').trim() : (existing?.account || '');
  const cleanSecret = item.secret !== undefined ? (item.secret || '').replace(/\s/g, '').toUpperCase() : (existing?.secret || '');
  const category = item.category || existing?.category || 'other';
  const digits = Number(item.digits || existing?.digits || 6) === 8 ? 8 : 6;
  const period = Number(item.period || existing?.period || 30) === 60 ? 60 : 30;
  const rawAlgo = String(item.algorithm || existing?.algorithm || 'SHA1').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const algorithm = ['SHA1', 'SHA256', 'SHA512'].includes(rawAlgo) ? rawAlgo : 'SHA1';
  const credId = item.credId !== undefined ? (item.credId || null) : (existing?.credId || null);
  const domain = item.domain !== undefined ? (item.domain || null) : (existing?.domain || null);
  const notes = item.notes !== undefined ? String(item.notes || '').slice(0, 500) : (existing?.notes || '');

  const entry = {
    id,
    issuer: cleanIssuer,
    account: cleanAccount,
    secret: cleanSecret,
    category,
    digits,
    period,
    algorithm,
    credId,
    domain,
    notes,
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    items[existingIdx] = entry;
  } else {
    items.push(entry);
  }

  await SecureStore.setItemAsync(TOTP_ITEMS_KEY, JSON.stringify(items));
  triggerBackgroundVaultSync();
  return items;
}

export async function deleteTotpItem(id) {
  let items = await getTotpItems();
  items = items.filter(t => t.id !== id);
  await SecureStore.setItemAsync(TOTP_ITEMS_KEY, JSON.stringify(items));
  triggerBackgroundVaultSync();
  return items;
}

export async function getFullVaultExport() {
  const index = await getDomainIndex();
  const credentials = [];

  for (const domain of index) {
    const accounts = await getCredentialsForDomain(domain);
    for (const cred of accounts) {
      const notes = cred.hasNote ? await getNote(cred.id) : '';
      credentials.push({
        id: cred.id,
        domain,
        name: cred.name || '',
        username: cred.username,
        password: cred.password,
        updatedAt: cred.updatedAt,
        category: cred.category || null,
        hidden: cred.hidden || false,
        expiresAt: cred.expiresAt || null,
        sharedBy: cred.sharedBy || null,
        hasNote: !!notes,
        notes: notes || '',
      });
    }
  }

  const categories = await getCategories();
  const profile = await getDefaultProfile();
  const totpItems = await getTotpItems();

  return {
     version: 2,
     exportedAt: new Date().toISOString(),
     credentials,
     categories,
     profile,
     totpItems,
   };
}

let isImportingVault = false;

export async function importFullVault(vaultObj) {
  if (!vaultObj) return false;
  isImportingVault = true;

  try {
    let credentialsList = [];
    if (Array.isArray(vaultObj)) {
      credentialsList = vaultObj;
    } else if (vaultObj.credentials && Array.isArray(vaultObj.credentials)) {
      credentialsList = vaultObj.credentials;
    }

    for (const cred of credentialsList) {
      if (cred && cred.domain && cred.username) {
        await saveCredentials(cred.domain, cred.username, cred.password || '', {
          id: cred.id,
          name: cred.name || '',
          category: cred.category,
          hidden: cred.hidden,
          expiresAt: cred.expiresAt,
          sharedBy: cred.sharedBy,
          notes: cred.notes !== undefined ? cred.notes : undefined,
        });
      }
    }

    if (vaultObj.categories && Array.isArray(vaultObj.categories) && vaultObj.categories.length > 0) {
      await SecureStore.setItemAsync(CATEGORIES_KEY, JSON.stringify(vaultObj.categories));
    }

    if (vaultObj.profile) {
      await saveDefaultProfile(vaultObj.profile);
    }

    if (vaultObj.totpItems && Array.isArray(vaultObj.totpItems)) {
      await SecureStore.setItemAsync(TOTP_ITEMS_KEY, JSON.stringify(vaultObj.totpItems));
    }

    return true;
  } finally {
    isImportingVault = false;
  }
}

export async function clearAllLocalVaultData() {
  const index = await getDomainIndex();
  for (const domain of index) {
    const key = `${CREDENTIALS_KEY}_${domain.replace(/\./g, '_')}`;
    try {
      const raw = await SecureStore.getItemAsync(key);
      if (raw) {
        const accounts = normalizeCredentialsArray(JSON.parse(raw), domain);
        for (const acc of accounts) {
          if (acc.id) {
            await SecureStore.deleteItemAsync(getNoteStorageKey(acc.id)).catch(() => {});
          }
        }
      }
    } catch {}
    await SecureStore.deleteItemAsync(key).catch(() => {});
  }
  await SecureStore.deleteItemAsync(INDEX_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(CATEGORIES_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(DEFAULT_PROFILE_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(TOTP_ITEMS_KEY).catch(() => {});
}

export async function triggerBackgroundVaultSync() {
  if (isImportingVault) return;
  try {
    const raw = await SecureStore.getItemAsync('auth_credentials');
    if (raw) {
      const creds = JSON.parse(raw);
      if (creds && creds.password) {
        const { syncVaultToServer } = require('./vault');
        syncVaultToServer(creds.password, creds.identifier, creds.email).catch(() => {});
      }
    }
  } catch (e) {}
}
