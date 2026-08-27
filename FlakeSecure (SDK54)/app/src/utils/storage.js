/**
 * ============================================================================
 * FlakeSecure Mobile App - Encrypted Local Storage & Category Store
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
 * ============================================================================
 */

export default {};

import * as SecureStore from 'expo-secure-store';

const CREDENTIALS_KEY = 'flakesecure_credentials_v1';
const INDEX_KEY = 'flakesecure_index_v1';
const CATEGORIES_KEY = 'flakesecure_categories_v1';
const DEFAULT_PROFILE_KEY = 'flakesecure_default_profile_v1';

export const DEFAULT_CATEGORIES = [
  { id: 'personal', name: 'Personal', icon: '👤', isDefault: true },
  { id: 'work', name: 'Work', icon: '💼', isDefault: true },
  { id: 'finance', name: 'Finance', icon: '💳', isDefault: true },
  { id: 'social', name: 'Social', icon: '💬', isDefault: true },
  { id: 'entertainment', name: 'Entertainment', icon: '🎮', isDefault: true },
  { id: 'other', name: 'Other', icon: '📁', isDefault: true },
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
  const icon = category.icon || '🏷️';

  const existingIdx = categories.findIndex(c => c.id === id || c.name.toLowerCase() === cleanName.toLowerCase());
  if (existingIdx >= 0) {
    categories[existingIdx] = { ...categories[existingIdx], name: cleanName, icon };
  } else {
    categories.push({ id, name: cleanName, icon, isDefault: false });
  }

  await SecureStore.setItemAsync(CATEGORIES_KEY, JSON.stringify(categories));
  return categories;
}

export async function deleteCategory(categoryId) {
  let categories = await getCategories();
  categories = categories.filter(c => c.id !== categoryId);
  await SecureStore.setItemAsync(CATEGORIES_KEY, JSON.stringify(categories));
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

export async function getCredentialsForDomain(domain) {
  try {
    const key = `${CREDENTIALS_KEY}_${domain.replace(/\./g, '_')}`;
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const creds = JSON.parse(raw);
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) {
      await deleteCredentials(domain);
      return null;
    }
    return creds;
  } catch {
    return null;
  }
}

export async function saveCredentials(domain, username, password, options = {}) {
  const key = `${CREDENTIALS_KEY}_${domain.replace(/\./g, '_')}`;
  const data = { 
    username, 
    password, 
    updatedAt: new Date().toISOString(),
    ...(options.category !== undefined && { category: options.category }),
    ...(options.hidden && { hidden: true }),
    ...(options.expiresAt && { expiresAt: options.expiresAt }),
    ...(options.sharedBy && { sharedBy: options.sharedBy }),
  };
  await SecureStore.setItemAsync(key, JSON.stringify(data));

  const index = await getDomainIndex();
  if (!index.includes(domain)) {
    index.push(domain);
    await saveDomainIndex(index);
  }
}

export async function deleteCredentials(domain) {
  const key = `${CREDENTIALS_KEY}_${domain.replace(/\./g, '_')}`;
  await SecureStore.deleteItemAsync(key);

  const index = await getDomainIndex();
  const updated = index.filter(d => d !== domain);
  await saveDomainIndex(updated);
}

export async function getAllCredentials() {
  const index = await getDomainIndex();
  const results = [];

  for (const domain of index) {
    const creds = await getCredentialsForDomain(domain);
    if (creds) {
      if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) {
        await deleteCredentials(domain);
        continue;
      }
      results.push({
        domain,
        username: creds.username,
        updatedAt: creds.updatedAt,
        category: creds.category || null,
        hidden: creds.hidden || false,
        expiresAt: creds.expiresAt || null,
        sharedBy: creds.sharedBy || null,
      });
    }
  }

  return results;
}

export async function findCredentialsForDomain(domain) {
  let creds = await getCredentialsForDomain(domain);
  if (creds) return { ...creds, domain };

  const parts = domain.split('.');
  if (parts.length > 2) {
    const rootDomain = parts.slice(-2).join('.');
    creds = await getCredentialsForDomain(rootDomain);
    if (creds) return { ...creds, domain: rootDomain };
  }

  return null;
}
