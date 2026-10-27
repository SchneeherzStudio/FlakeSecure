/**
 * ============================================================================
 * FlakeSecure Mobile App - Encrypted Local Storage & Category Store v2.1
 * ============================================================================
 */

export default {};

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncVaultToNativeAutofill } from './autofillBridge';
import {
  normalizeIban,
  formatIban,
  validateIban,
  lookupBankByIban,
  lookupBankByIbanOnline,
} from './ibanLookup';

export {
  normalizeIban,
  formatIban,
  validateIban,
  lookupBankByIban,
  lookupBankByIbanOnline,
};

const CREDENTIALS_KEY = 'flakesecure_credentials_v1';
const INDEX_KEY = 'flakesecure_index_v1';
const CATEGORIES_KEY = 'flakesecure_categories_v1';
const DEFAULT_PROFILE_KEY = 'flakesecure_default_profile_v1';
const TOTP_ITEMS_KEY = 'flakesecure_totp_items_v1';
const NOTE_KEY_PREFIX = 'flakesecure_note_';

const BANK_ACCOUNTS_INDEX_KEY = 'flakesecure_bank_accounts_index_v1';
const BANK_ACCOUNT_KEY_PREFIX = 'flakesecure_bank_acc_';

const CARDS_INDEX_KEY = 'flakesecure_cards_index_v1';
const CARD_KEY_PREFIX = 'flakesecure_card_';

const CODES_INDEX_KEY = 'flakesecure_codes_index_v1';
const CODE_KEY_PREFIX = 'flakesecure_code_';

export const PENDING_VAULT_SYNC_KEY = 'flakesecure_pending_vault_sync_v1';
export const LAST_VAULT_SYNC_KEY = 'flakesecure_last_vault_sync_at_v1';

function sanitizeStorageId(rawId) {
  return String(rawId || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getNoteStorageKey(credId) {
  return `${NOTE_KEY_PREFIX}${sanitizeStorageId(credId)}`;
}

function getBankAccountStorageKey(accountId) {
  return `${BANK_ACCOUNT_KEY_PREFIX}${sanitizeStorageId(accountId)}`;
}

function getCardStorageKey(cardId) {
  return `${CARD_KEY_PREFIX}${sanitizeStorageId(cardId)}`;
}

function getCodeStorageKey(codeId) {
  return `${CODE_KEY_PREFIX}${sanitizeStorageId(codeId)}`;
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

export async function saveNote(credId, text) {
  if (!credId) return '';
  const cleanNote = String(text || '').slice(0, 1000);
  if (cleanNote.trim().length > 0) {
    await SecureStore.setItemAsync(getNoteStorageKey(credId), cleanNote);
  } else {
    await SecureStore.deleteItemAsync(getNoteStorageKey(credId)).catch(() => {});
  }
  return cleanNote;
}

export const setNote = saveNote;

export const DEFAULT_CATEGORIES = [
  { id: 'personal', name: 'Personal', icon: 'user', isDefault: true },
  { id: 'work', name: 'Work', icon: 'briefcase', isDefault: true },
  { id: 'finance', name: 'Finance', icon: 'card', isDefault: true },
  { id: 'social', name: 'Social', icon: 'message', isDefault: true },
  { id: 'entertainment', name: 'Entertainment', icon: 'code', isDefault: true },
  { id: 'other', name: 'Other', icon: 'folder', isDefault: true },
];

export const CARD_COLOR_THEMES = {
  gold: {
    id: 'gold',
    labelKey: 'cards.colorGold',
    gradient: ['#3a2a0a', '#171104'],
    accent: '#E8B020',
    border: 'rgba(232, 176, 32, 0.45)',
  },
  midnight: {
    id: 'midnight',
    labelKey: 'cards.colorMidnight',
    gradient: ['#16203d', '#090e1c'],
    accent: '#60a5fa',
    border: 'rgba(96, 165, 250, 0.40)',
  },
  emerald: {
    id: 'emerald',
    labelKey: 'cards.colorEmerald',
    gradient: ['#0d3327', '#061913'],
    accent: '#34d399',
    border: 'rgba(52, 211, 153, 0.40)',
  },
  crimson: {
    id: 'crimson',
    labelKey: 'cards.colorCrimson',
    gradient: ['#3d131b', '#1b080c'],
    accent: '#f87171',
    border: 'rgba(248, 113, 113, 0.40)',
  },
  ocean: {
    id: 'ocean',
    labelKey: 'cards.colorOcean',
    gradient: ['#0d2e42', '#061621'],
    accent: '#38bdf8',
    border: 'rgba(56, 189, 248, 0.40)',
  },
  slate: {
    id: 'slate',
    labelKey: 'cards.colorSlate',
    gradient: ['#262b38', '#11141c'],
    accent: '#cbd5e1',
    border: 'rgba(203, 213, 225, 0.35)',
  },
};

export const CODE_CATEGORIES = [
  { id: 'door', icon: 'door', labelKey: 'codes.cat_door' },
  { id: 'bikelock', icon: 'bike', labelKey: 'codes.cat_bikelock' },
  { id: 'safe', icon: 'safe', labelKey: 'codes.cat_safe' },
  { id: 'alarm', icon: 'bell', labelKey: 'codes.cat_alarm' },
  { id: 'locker', icon: 'locker', labelKey: 'codes.cat_locker' },
  { id: 'garage', icon: 'garage', labelKey: 'codes.cat_garage' },
  { id: 'wifi', icon: 'wifi', labelKey: 'codes.cat_wifi' },
  { id: 'other', icon: 'keypad', labelKey: 'codes.cat_other' },
];

export function detectCardBrand(number) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return 'other';
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2(2(2[1-9]|[3-9]\d)|[3-6]\d\d|7([01]\d|20)))/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^(5018|5020|5038|5893|6304|6759|6761|6762|6763)/.test(digits)) return 'maestro';
  if (/^(6011|65|64[4-9])/.test(digits)) return 'discover';
  if (/^3(0[0-5]|[68])/.test(digits)) return 'diners';
  if (/^(2131|1800|35)/.test(digits)) return 'jcb';
  return 'other';
}

export function getCardBrandDisplayName(brand) {
  switch (String(brand || '').toLowerCase()) {
    case 'visa':
      return 'VISA';
    case 'mastercard':
      return 'Mastercard';
    case 'amex':
      return 'AMEX';
    case 'maestro':
      return 'Maestro';
    case 'discover':
      return 'Discover';
    case 'diners':
      return 'Diners Club';
    case 'jcb':
      return 'JCB';
    case 'girocard':
      return 'Girocard';
    default:
      return 'CARD';
  }
}

export function validateLuhn(number) {
  const digits = String(number || '').replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (Number.isNaN(digit)) return false;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function formatCardNumber(number, mask = false) {
  const digits = String(number || '').replace(/\D/g, '').slice(0, 19);
  if (!digits) return mask ? '•••• •••• •••• ••••' : '';
  const brand = detectCardBrand(digits);
  if (mask) {
    const last4 = digits.slice(-4).padStart(4, '•');
    return `•••• •••• •••• ${last4}`;
  }
  if (brand === 'amex') {
    const p1 = digits.slice(0, 4);
    const p2 = digits.slice(4, 10);
    const p3 = digits.slice(10, 15);
    return [p1, p2, p3].filter(Boolean).join(' ');
  }
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function getCardExpiryStatus(expiryMonth, expiryYear) {
  const m = parseInt(String(expiryMonth || '').replace(/\D/g, ''), 10);
  let y = parseInt(String(expiryYear || '').replace(/\D/g, ''), 10);
  if (!m || m < 1 || m > 12 || !y) {
    return { isExpired: false, isExpiringSoon: false, daysRemaining: null, formatted: '' };
  }
  const twoDigitYear = y >= 2000 ? y - 2000 : y;
  const fullYear = y < 100 ? 2000 + y : y;
  const mm = String(m).padStart(2, '0');
  const yy = String(twoDigitYear).padStart(2, '0');
  const formatted = `${mm}/${yy}`;

  // Card is valid through the last millisecond of the expiry month
  const expiryEnd = new Date(fullYear, m, 0, 23, 59, 59, 999);
  const now = new Date();
  const diffMs = expiryEnd.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    isExpired: diffMs < 0,
    isExpiringSoon: diffMs >= 0 && daysRemaining <= 30,
    daysRemaining,
    formatted,
  };
}

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

  const existingIdx = categories.findIndex(
    (c) => c.id === id || c.name.toLowerCase() === cleanName.toLowerCase()
  );
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
  categories = categories.filter((c) => c.id !== categoryId);
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
  return [
    {
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
    },
  ];
}

export async function getCredentialsForDomain(domain) {
  try {
    const key = `${CREDENTIALS_KEY}_${domain.replace(/\./g, '_')}`;
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return [];
    const accounts = normalizeCredentialsArray(JSON.parse(raw), domain);
    const now = new Date();
    const valid = accounts.filter((a) => !a.expiresAt || new Date(a.expiresAt) >= now);
    if (valid.length !== accounts.length) {
      for (const acc of accounts) {
        if (!valid.some((v) => v.id === acc.id)) {
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
    foundIndex = accounts.findIndex((a) => a.id === credId);
  } else if (cleanUsername) {
    foundIndex = accounts.findIndex(
      (a) => a.username.toLowerCase() === cleanUsername.toLowerCase() && (a.name || '') === name
    );
    if (foundIndex === -1 && !name) {
      foundIndex = accounts.findIndex(
        (a) => a.username.toLowerCase() === cleanUsername.toLowerCase()
      );
    }
  }

  const existing = foundIndex >= 0 ? accounts[foundIndex] : null;
  const id =
    credId || existing?.id || `cred_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

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
    name: options.name !== undefined ? name : existing?.name || '',
    username: cleanUsername || existing?.username || '',
    password: options.hidden && !password && existing ? existing.password : password,
    updatedAt: now,
    category: options.category !== undefined ? options.category : existing?.category || null,
    hidden: options.hidden !== undefined ? !!options.hidden : existing?.hidden || false,
    expiresAt: options.expiresAt !== undefined ? options.expiresAt : existing?.expiresAt || null,
    sharedBy: options.sharedBy !== undefined ? options.sharedBy : existing?.sharedBy || null,
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

export const saveCredential = saveCredentials;

export async function deleteCredentials(domain, credId = null) {
  const key = `${CREDENTIALS_KEY}_${domain.replace(/\./g, '_')}`;

  if (credId) {
    await SecureStore.deleteItemAsync(getNoteStorageKey(credId)).catch(() => {});
    const raw = await SecureStore.getItemAsync(key);
    if (raw) {
      let accounts = normalizeCredentialsArray(JSON.parse(raw), domain);
      accounts = accounts.filter((a) => a.id !== credId);
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
  const updated = index.filter((d) => d !== domain);
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
        password: cred.password,
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

// ============================================================================
// BANK ACCOUNTS STORAGE (Konten mit IBAN, Name, automatischer BIC & Bank-Erkennung)
// ============================================================================

async function getBankAccountsIndex() {
  try {
    const raw = await SecureStore.getItemAsync(BANK_ACCOUNTS_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveBankAccountsIndex(ids) {
  await SecureStore.setItemAsync(BANK_ACCOUNTS_INDEX_KEY, JSON.stringify(ids));
}

export async function getBankAccountById(accountId) {
  if (!accountId) return null;
  try {
    const raw = await SecureStore.getItemAsync(getBankAccountStorageKey(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cleanIban = normalizeIban(parsed.iban || '');
    const lookup = cleanIban ? lookupBankByIban(cleanIban) : null;
    return {
      id: parsed.id || accountId,
      name: parsed.name || '',
      iban: cleanIban,
      bic: parsed.bic || lookup?.bic || '',
      bankName: parsed.bankName || lookup?.bankName || '',
      holderName: parsed.holderName || '',
      color: parsed.color || 'gold',
      hasNote: !!parsed.hasNote,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getBankAccounts() {
  const index = await getBankAccountsIndex();
  const accounts = [];
  for (const id of index) {
    const acc = await getBankAccountById(id);
    if (acc) {
      accounts.push(acc);
    }
  }
  return accounts;
}

export async function saveBankAccount(accountInput = {}, options = {}) {
  const cleanIban = normalizeIban(accountInput.iban || '');
  const cleanName = String(accountInput.name || '').trim();
  const allExisting = await getBankAccounts();

  // Match by explicit id, or by normalized IBAN if creating without id
  let targetId = accountInput.id || null;
  if (!targetId && cleanIban) {
    const byIban = allExisting.find(
      (a) => a.iban && normalizeIban(a.iban) === cleanIban
    );
    if (byIban) targetId = byIban.id;
  }
  if (!targetId && cleanName) {
    const byName = allExisting.find(
      (a) => a.name && a.name.toLowerCase() === cleanName.toLowerCase() && !a.iban
    );
    if (byName) targetId = byName.id;
  }

  const id =
    targetId || `bacc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const existing = targetId ? await getBankAccountById(id) : null;
  const now = new Date().toISOString();

  const effectiveIban =
    accountInput.iban !== undefined ? cleanIban : existing?.iban || '';
  const detected = effectiveIban ? lookupBankByIban(effectiveIban) : null;

  let hasNote = !!existing?.hasNote;
  if (accountInput.notes !== undefined) {
    const cleanNote = String(accountInput.notes || '').slice(0, 1000);
    if (cleanNote.trim().length > 0) {
      await SecureStore.setItemAsync(getNoteStorageKey(id), cleanNote);
      hasNote = true;
    } else {
      await SecureStore.deleteItemAsync(getNoteStorageKey(id)).catch(() => {});
      hasNote = false;
    }
  }

  const rawBic =
    accountInput.bic !== undefined
      ? String(accountInput.bic || '')
          .replace(/\s+/g, '')
          .toUpperCase()
      : existing?.bic || '';
  const rawBankName =
    accountInput.bankName !== undefined
      ? String(accountInput.bankName || '').trim()
      : existing?.bankName || '';

  const entry = {
    id,
    name:
      accountInput.name !== undefined
        ? cleanName
        : existing?.name || rawBankName || detected?.bankName || 'Girokonto',
    iban: effectiveIban,
    bic: rawBic || detected?.bic || '',
    bankName: rawBankName || detected?.bankName || '',
    holderName:
      accountInput.holderName !== undefined
        ? String(accountInput.holderName || '').trim()
        : existing?.holderName || '',
    color: accountInput.color || existing?.color || 'gold',
    hasNote,
    updatedAt: now,
  };

  await SecureStore.setItemAsync(getBankAccountStorageKey(id), JSON.stringify(entry));

  const index = await getBankAccountsIndex();
  if (!index.includes(id)) {
    index.push(id);
    await saveBankAccountsIndex(index);
  }

  // Keep linked cards synchronized when account metadata changes
  if (!options.skipCardPropagation) {
    try {
      const cardIds = await getCardsIndex();
      for (const cid of cardIds) {
        const rawCard = await SecureStore.getItemAsync(getCardStorageKey(cid));
        if (!rawCard) continue;
        const parsedCard = JSON.parse(rawCard);
        if (
          parsedCard.accountId === id ||
          (entry.iban &&
            parsedCard.iban &&
            normalizeIban(parsedCard.iban) === entry.iban)
        ) {
          const updatedCard = {
            ...parsedCard,
            accountId: id,
            accountName: entry.name,
            iban: entry.iban || parsedCard.iban || '',
            bic: entry.bic || parsedCard.bic || '',
            issuer: entry.bankName || parsedCard.issuer || '',
          };
          await SecureStore.setItemAsync(
            getCardStorageKey(cid),
            JSON.stringify(updatedCard)
          );
        }
      }
    } catch {}
  }

  if (!options.skipSync) {
    triggerBackgroundVaultSync();
  }
  return entry;
}

export async function deleteBankAccount(accountId, options = { deleteCards: true }) {
  if (!accountId) return;
  await SecureStore.deleteItemAsync(getBankAccountStorageKey(accountId)).catch(() => {});
  await SecureStore.deleteItemAsync(getNoteStorageKey(accountId)).catch(() => {});
  const index = await getBankAccountsIndex();
  const updated = index.filter((id) => id !== accountId);
  await saveBankAccountsIndex(updated);

  const cardIds = await getCardsIndex();
  if (options.deleteCards) {
    const remainingCards = [];
    for (const cid of cardIds) {
      const card = await getCardById(cid);
      if (card && card.accountId === accountId) {
        await SecureStore.deleteItemAsync(getCardStorageKey(cid)).catch(() => {});
        await SecureStore.deleteItemAsync(getNoteStorageKey(cid)).catch(() => {});
      } else {
        remainingCards.push(cid);
      }
    }
    await saveCardsIndex(remainingCards);
  } else {
    for (const cid of cardIds) {
      const card = await getCardById(cid);
      if (card && card.accountId === accountId) {
        await SecureStore.setItemAsync(
          getCardStorageKey(cid),
          JSON.stringify({ ...card, accountId: null, accountName: '' })
        );
      }
    }
  }

  triggerBackgroundVaultSync();
}

// ============================================================================
// BANK CARDS STORAGE (SecureStore)
// ============================================================================

async function getCardsIndex() {
  try {
    const raw = await SecureStore.getItemAsync(CARDS_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveCardsIndex(ids) {
  await SecureStore.setItemAsync(CARDS_INDEX_KEY, JSON.stringify(ids));
}

export async function getCardById(cardId) {
  if (!cardId) return null;
  try {
    const raw = await SecureStore.getItemAsync(getCardStorageKey(cardId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cleanIban = normalizeIban(parsed.iban || '');
    const lookup = cleanIban ? lookupBankByIban(cleanIban) : null;
    return {
      id: parsed.id || cardId,
      accountId: parsed.accountId || null,
      accountName: parsed.accountName || '',
      label: parsed.label || '',
      cardholderName: parsed.cardholderName || '',
      number: parsed.number || '',
      expiryMonth: parsed.expiryMonth || '',
      expiryYear: parsed.expiryYear || '',
      cvv: parsed.cvv || '',
      pin: parsed.pin || '',
      brand: parsed.brand || detectCardBrand(parsed.number),
      issuer: parsed.issuer || lookup?.bankName || '',
      iban: cleanIban,
      bic: parsed.bic || lookup?.bic || '',
      color: parsed.color || 'gold',
      category: parsed.category || 'finance',
      hasNote: !!parsed.hasNote,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getCards() {
  const index = await getCardsIndex();
  const cards = [];
  for (const id of index) {
    const card = await getCardById(id);
    if (card) {
      cards.push(card);
    }
  }
  return cards;
}

export async function saveCard(cardInput = {}) {
  const id =
    cardInput.id || `card_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const existing = await getCardById(id);
  const now = new Date().toISOString();

  const cleanDigits = String(
    cardInput.number !== undefined ? cardInput.number : existing?.number || ''
  )
    .replace(/\D/g, '')
    .slice(0, 19);

  let hasNote = !!existing?.hasNote;
  if (cardInput.notes !== undefined) {
    const cleanNote = String(cardInput.notes || '').slice(0, 1000);
    if (cleanNote.trim().length > 0) {
      await SecureStore.setItemAsync(getNoteStorageKey(id), cleanNote);
      hasNote = true;
    } else {
      await SecureStore.deleteItemAsync(getNoteStorageKey(id)).catch(() => {});
      hasNote = false;
    }
  }

  const brand =
    cardInput.brand && cardInput.brand !== 'other'
      ? cardInput.brand
      : detectCardBrand(cleanDigits);

  const rawMonth = String(
    cardInput.expiryMonth !== undefined ? cardInput.expiryMonth : existing?.expiryMonth || ''
  ).replace(/\D/g, '');
  const expiryMonth = rawMonth
    ? String(Math.min(12, Math.max(1, parseInt(rawMonth, 10) || 1))).padStart(2, '0')
    : '';

  const rawYear = String(
    cardInput.expiryYear !== undefined ? cardInput.expiryYear : existing?.expiryYear || ''
  ).replace(/\D/g, '');
  const expiryYear = rawYear ? rawYear.slice(-2).padStart(2, '0') : '';

  const inputIban =
    cardInput.iban !== undefined
      ? normalizeIban(cardInput.iban)
      : existing?.iban || '';
  const detectedBank = inputIban ? lookupBankByIban(inputIban) : null;

  const inputIssuer =
    cardInput.issuer !== undefined
      ? String(cardInput.issuer || '').trim()
      : existing?.issuer || '';
  const inputBic =
    cardInput.bic !== undefined
      ? String(cardInput.bic || '')
          .replace(/\s+/g, '')
          .toUpperCase()
      : existing?.bic || '';
  const inputAccountName =
    cardInput.accountName !== undefined
      ? String(cardInput.accountName || '').trim()
      : existing?.accountName || '';

  let linkedAccountId =
    cardInput.accountId !== undefined ? cardInput.accountId : existing?.accountId || null;
  let finalAccountName = inputAccountName;
  let finalIban = inputIban;
  let finalBic = inputBic || detectedBank?.bic || '';
  let finalIssuer = inputIssuer || detectedBank?.bankName || '';

  // Auto-link or create/update the Bank Account when accountId, accountName, or IBAN is provided
  if (linkedAccountId || finalAccountName || finalIban) {
    const savedAcc = await saveBankAccount(
      {
        id: linkedAccountId || undefined,
        name: finalAccountName || finalIssuer || 'Girokonto',
        iban: finalIban,
        bic: finalBic,
        bankName: finalIssuer,
        holderName:
          cardInput.cardholderName !== undefined
            ? String(cardInput.cardholderName || '').trim()
            : existing?.cardholderName || '',
        color: cardInput.color || existing?.color || 'gold',
      },
      { skipSync: true, skipCardPropagation: true }
    );
    linkedAccountId = savedAcc.id;
    finalAccountName = savedAcc.name;
    finalIban = savedAcc.iban || finalIban;
    finalBic = finalBic || savedAcc.bic || '';
    finalIssuer = finalIssuer || savedAcc.bankName || '';
  }

  const entry = {
    id,
    accountId: linkedAccountId,
    accountName: finalAccountName,
    label:
      cardInput.label !== undefined
        ? String(cardInput.label || '').trim()
        : existing?.label || '',
    cardholderName:
      cardInput.cardholderName !== undefined
        ? String(cardInput.cardholderName || '').trim()
        : existing?.cardholderName || '',
    number: cleanDigits,
    expiryMonth,
    expiryYear,
    cvv:
      cardInput.cvv !== undefined
        ? String(cardInput.cvv || '').replace(/\D/g, '').slice(0, 4)
        : existing?.cvv || '',
    pin:
      cardInput.pin !== undefined
        ? String(cardInput.pin || '').replace(/\D/g, '').slice(0, 8)
        : existing?.pin || '',
    brand,
    issuer: finalIssuer,
    iban: finalIban,
    bic: finalBic,
    color: cardInput.color || existing?.color || 'gold',
    category: cardInput.category !== undefined ? cardInput.category : existing?.category || 'finance',
    hasNote,
    updatedAt: now,
  };

  await SecureStore.setItemAsync(getCardStorageKey(id), JSON.stringify(entry));

  const index = await getCardsIndex();
  if (!index.includes(id)) {
    index.push(id);
    await saveCardsIndex(index);
  }

  triggerBackgroundVaultSync();
  return entry;
}

export async function deleteCard(cardId) {
  if (!cardId) return;
  await SecureStore.deleteItemAsync(getCardStorageKey(cardId)).catch(() => {});
  await SecureStore.deleteItemAsync(getNoteStorageKey(cardId)).catch(() => {});
  const index = await getCardsIndex();
  const updated = index.filter((id) => id !== cardId);
  await saveCardsIndex(updated);
  triggerBackgroundVaultSync();
}

// ============================================================================
// CODES STORAGE (Door Codes, Bike Locks, Safes, Alarms, etc.)
// ============================================================================

async function getCodesIndex() {
  try {
    const raw = await SecureStore.getItemAsync(CODES_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveCodesIndex(ids) {
  await SecureStore.setItemAsync(CODES_INDEX_KEY, JSON.stringify(ids));
}

export async function getCodeById(codeId) {
  if (!codeId) return null;
  try {
    const raw = await SecureStore.getItemAsync(getCodeStorageKey(codeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      id: parsed.id || codeId,
      label: parsed.label || '',
      code: parsed.code || '',
      codeCategory: parsed.codeCategory || 'door',
      location: parsed.location || '',
      hasNote: !!parsed.hasNote,
      sharedBy: parsed.sharedBy || null,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getCodes() {
  const index = await getCodesIndex();
  const codes = [];
  for (const id of index) {
    const item = await getCodeById(id);
    if (item) {
      codes.push(item);
    }
  }
  return codes;
}

export async function saveCode(codeInput = {}) {
  const id =
    codeInput.id || `code_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const existing = await getCodeById(id);
  const now = new Date().toISOString();

  let hasNote = !!existing?.hasNote;
  if (codeInput.notes !== undefined) {
    const cleanNote = String(codeInput.notes || '').slice(0, 1000);
    if (cleanNote.trim().length > 0) {
      await SecureStore.setItemAsync(getNoteStorageKey(id), cleanNote);
      hasNote = true;
    } else {
      await SecureStore.deleteItemAsync(getNoteStorageKey(id)).catch(() => {});
      hasNote = false;
    }
  }

  const entry = {
    id,
    label:
      codeInput.label !== undefined
        ? String(codeInput.label || '').trim()
        : existing?.label || '',
    code:
      codeInput.code !== undefined
        ? String(codeInput.code || '').trim()
        : existing?.code || '',
    codeCategory: codeInput.codeCategory || existing?.codeCategory || 'door',
    location:
      codeInput.location !== undefined
        ? String(codeInput.location || '').trim()
        : existing?.location || '',
    sharedBy:
      codeInput.sharedBy !== undefined ? codeInput.sharedBy : existing?.sharedBy || null,
    hasNote,
    updatedAt: now,
  };

  await SecureStore.setItemAsync(getCodeStorageKey(id), JSON.stringify(entry));

  const index = await getCodesIndex();
  if (!index.includes(id)) {
    index.push(id);
    await saveCodesIndex(index);
  }

  triggerBackgroundVaultSync();
  return entry;
}

export async function deleteCode(codeId) {
  if (!codeId) return;
  await SecureStore.deleteItemAsync(getCodeStorageKey(codeId)).catch(() => {});
  await SecureStore.deleteItemAsync(getNoteStorageKey(codeId)).catch(() => {});
  const index = await getCodesIndex();
  const updated = index.filter((id) => id !== codeId);
  await saveCodesIndex(updated);
  triggerBackgroundVaultSync();
}

// ============================================================================
// CUSTOM DISPLAY ORDER / REORDERING HELPERS
// ============================================================================

function swapElementsInList(list, itemA, itemB) {
  const arr = Array.isArray(list) ? [...list] : [];
  const idxA = arr.indexOf(itemA);
  const idxB = arr.indexOf(itemB);
  if (idxA === -1 || idxB === -1 || idxA === idxB) return arr;
  const temp = arr[idxA];
  arr[idxA] = arr[idxB];
  arr[idxB] = temp;
  return arr;
}

export async function moveDomainOrder(domainA, domainB) {
  if (!domainA || !domainB || domainA === domainB) return;
  const index = await getDomainIndex();
  const updated = swapElementsInList(index, domainA, domainB);
  await saveDomainIndex(updated);
  triggerBackgroundVaultSync();
  return updated;
}

export async function moveDomainAccountOrder(domain, accountIdA, accountIdB) {
  if (!domain || !accountIdA || !accountIdB || accountIdA === accountIdB) return;
  const key = `${CREDENTIALS_KEY}_${domain.replace(/\./g, '_')}`;
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return;
  const accounts = normalizeCredentialsArray(JSON.parse(raw), domain);
  const idxA = accounts.findIndex((a) => a.id === accountIdA);
  const idxB = accounts.findIndex((a) => a.id === accountIdB);
  if (idxA === -1 || idxB === -1 || idxA === idxB) return;
  const temp = accounts[idxA];
  accounts[idxA] = accounts[idxB];
  accounts[idxB] = temp;
  await SecureStore.setItemAsync(key, JSON.stringify(accounts));
  triggerBackgroundVaultSync();
  return accounts;
}

export async function moveBankAccountOrder(accountIdA, accountIdB) {
  if (!accountIdA || !accountIdB || accountIdA === accountIdB) return;
  const index = await getBankAccountsIndex();
  const updated = swapElementsInList(index, accountIdA, accountIdB);
  await saveBankAccountsIndex(updated);
  triggerBackgroundVaultSync();
  return updated;
}

export async function moveCardOrder(cardIdA, cardIdB) {
  if (!cardIdA || !cardIdB || cardIdA === cardIdB) return;
  const index = await getCardsIndex();
  const updated = swapElementsInList(index, cardIdA, cardIdB);
  await saveCardsIndex(updated);
  triggerBackgroundVaultSync();
  return updated;
}

export async function moveCodeOrder(codeIdA, codeIdB) {
  if (!codeIdA || !codeIdB || codeIdA === codeIdB) return;
  const index = await getCodesIndex();
  const updated = swapElementsInList(index, codeIdA, codeIdB);
  await saveCodesIndex(updated);
  triggerBackgroundVaultSync();
  return updated;
}

// ============================================================================
// TOTP AUTHENTICATOR ITEMS STORAGE
// ============================================================================

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
  const existingIdx = items.findIndex((t) => t.id === id);
  const existing = existingIdx >= 0 ? items[existingIdx] : null;

  const cleanIssuer =
    item.issuer !== undefined ? (item.issuer || '').trim() : existing?.issuer || '';
  const cleanAccount =
    item.account !== undefined ? (item.account || '').trim() : existing?.account || '';
  const cleanSecret =
    item.secret !== undefined
      ? (item.secret || '').replace(/\s/g, '').toUpperCase()
      : existing?.secret || '';
  const category = item.category || existing?.category || 'other';
  const digits = Number(item.digits || existing?.digits || 6) === 8 ? 8 : 6;
  const period = Number(item.period || existing?.period || 30) === 60 ? 60 : 30;
  const rawAlgo = String(item.algorithm || existing?.algorithm || 'SHA1')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const algorithm = ['SHA1', 'SHA256', 'SHA512'].includes(rawAlgo) ? rawAlgo : 'SHA1';
  const credId =
    item.credId !== undefined ? item.credId || null : existing?.credId || null;
  const domain =
    item.domain !== undefined ? item.domain || null : existing?.domain || null;
  const notes =
    item.notes !== undefined
      ? String(item.notes || '').slice(0, 500)
      : existing?.notes || '';

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
  items = items.filter((t) => t.id !== id);
  await SecureStore.setItemAsync(TOTP_ITEMS_KEY, JSON.stringify(items));
  triggerBackgroundVaultSync();
  return items;
}

// ============================================================================
// FULL VAULT EXPORT / IMPORT & OFFLINE SYNC TRACKING
// ============================================================================

export async function hasLocalVaultData() {
  try {
    const [domains, bankAccIdx, cardsIdx, codesIdx, totp] = await Promise.all([
      getDomainIndex(),
      getBankAccountsIndex(),
      getCardsIndex(),
      getCodesIndex(),
      getTotpItems(),
    ]);
    return (
      domains.length > 0 ||
      bankAccIdx.length > 0 ||
      cardsIdx.length > 0 ||
      codesIdx.length > 0 ||
      totp.length > 0
    );
  } catch {
    return false;
  }
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

  const rawBankAccounts = await getBankAccounts();
  const bankAccounts = [];
  for (const acc of rawBankAccounts) {
    const notes = acc.hasNote ? await getNote(acc.id) : '';
    bankAccounts.push({
      ...acc,
      hasNote: !!notes,
      notes: notes || '',
    });
  }

  const rawCards = await getCards();
  const cards = [];
  for (const card of rawCards) {
    const notes = card.hasNote ? await getNote(card.id) : '';
    cards.push({
      ...card,
      hasNote: !!notes,
      notes: notes || '',
    });
  }

  const rawCodes = await getCodes();
  const codes = [];
  for (const codeItem of rawCodes) {
    const notes = codeItem.hasNote ? await getNote(codeItem.id) : '';
    codes.push({
      ...codeItem,
      hasNote: !!notes,
      notes: notes || '',
    });
  }

  const categories = await getCategories();
  const profile = await getDefaultProfile();
  const totpItems = await getTotpItems();

  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    credentials,
    bankAccounts,
    cards,
    codes,
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

    const importedDomainOrder = [];
    for (const cred of credentialsList) {
      if (cred && cred.domain && cred.username) {
        if (!importedDomainOrder.includes(cred.domain)) {
          importedDomainOrder.push(cred.domain);
        }
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
    if (importedDomainOrder.length > 0) {
      const currentDomains = await getDomainIndex();
      const mergedDomains = [
        ...importedDomainOrder,
        ...currentDomains.filter((d) => !importedDomainOrder.includes(d)),
      ];
      await saveDomainIndex(mergedDomains);
    }

    if (vaultObj.bankAccounts && Array.isArray(vaultObj.bankAccounts)) {
      const importedBankAccOrder = [];
      for (const acc of vaultObj.bankAccounts) {
        if (acc && (acc.name || acc.iban)) {
          const saved = await saveBankAccount(
            {
              ...acc,
              notes: acc.notes !== undefined ? acc.notes : undefined,
            },
            { skipSync: true }
          );
          if (saved?.id && !importedBankAccOrder.includes(saved.id)) {
            importedBankAccOrder.push(saved.id);
          }
        }
      }
      if (importedBankAccOrder.length > 0) {
        const currentBankAccs = await getBankAccountsIndex();
        const mergedBankAccs = [
          ...importedBankAccOrder,
          ...currentBankAccs.filter((id) => !importedBankAccOrder.includes(id)),
        ];
        await saveBankAccountsIndex(mergedBankAccs);
      }
    }

    if (vaultObj.cards && Array.isArray(vaultObj.cards)) {
      const importedCardOrder = [];
      for (const card of vaultObj.cards) {
        if (card && (card.number || card.label)) {
          const saved = await saveCard({
            ...card,
            notes: card.notes !== undefined ? card.notes : undefined,
          });
          if (saved?.id && !importedCardOrder.includes(saved.id)) {
            importedCardOrder.push(saved.id);
          }
        }
      }
      if (importedCardOrder.length > 0) {
        const currentCards = await getCardsIndex();
        const mergedCards = [
          ...importedCardOrder,
          ...currentCards.filter((id) => !importedCardOrder.includes(id)),
        ];
        await saveCardsIndex(mergedCards);
      }
    }

    if (vaultObj.codes && Array.isArray(vaultObj.codes)) {
      const importedCodeOrder = [];
      for (const codeItem of vaultObj.codes) {
        if (codeItem && (codeItem.code || codeItem.label)) {
          const saved = await saveCode({
            ...codeItem,
            notes: codeItem.notes !== undefined ? codeItem.notes : undefined,
          });
          if (saved?.id && !importedCodeOrder.includes(saved.id)) {
            importedCodeOrder.push(saved.id);
          }
        }
      }
      if (importedCodeOrder.length > 0) {
        const currentCodes = await getCodesIndex();
        const mergedCodes = [
          ...importedCodeOrder,
          ...currentCodes.filter((id) => !importedCodeOrder.includes(id)),
        ];
        await saveCodesIndex(mergedCodes);
      }
    }

    if (
      vaultObj.categories &&
      Array.isArray(vaultObj.categories) &&
      vaultObj.categories.length > 0
    ) {
      await SecureStore.setItemAsync(CATEGORIES_KEY, JSON.stringify(vaultObj.categories));
    }

    if (vaultObj.profile) {
      await saveDefaultProfile(vaultObj.profile);
    }

    if (vaultObj.totpItems && Array.isArray(vaultObj.totpItems)) {
      await SecureStore.setItemAsync(TOTP_ITEMS_KEY, JSON.stringify(vaultObj.totpItems));
    }

    syncVaultToNativeAutofill().catch(() => {});
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

  const bankAccIds = await getBankAccountsIndex();
  for (const id of bankAccIds) {
    await SecureStore.deleteItemAsync(getBankAccountStorageKey(id)).catch(() => {});
    await SecureStore.deleteItemAsync(getNoteStorageKey(id)).catch(() => {});
  }
  await SecureStore.deleteItemAsync(BANK_ACCOUNTS_INDEX_KEY).catch(() => {});

  const cardIds = await getCardsIndex();
  for (const id of cardIds) {
    await SecureStore.deleteItemAsync(getCardStorageKey(id)).catch(() => {});
    await SecureStore.deleteItemAsync(getNoteStorageKey(id)).catch(() => {});
  }
  await SecureStore.deleteItemAsync(CARDS_INDEX_KEY).catch(() => {});

  const codeIds = await getCodesIndex();
  for (const id of codeIds) {
    await SecureStore.deleteItemAsync(getCodeStorageKey(id)).catch(() => {});
    await SecureStore.deleteItemAsync(getNoteStorageKey(id)).catch(() => {});
  }
  await SecureStore.deleteItemAsync(CODES_INDEX_KEY).catch(() => {});

  await SecureStore.deleteItemAsync(CATEGORIES_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(DEFAULT_PROFILE_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(TOTP_ITEMS_KEY).catch(() => {});

  syncVaultToNativeAutofill({ credentials: [], cards: [] }).catch(() => {});
}

export async function markPendingVaultSync() {
  try {
    await AsyncStorage.setItem(PENDING_VAULT_SYNC_KEY, new Date().toISOString());
  } catch {}
}

export async function clearPendingVaultSync() {
  try {
    await AsyncStorage.removeItem(PENDING_VAULT_SYNC_KEY);
    await AsyncStorage.setItem(LAST_VAULT_SYNC_KEY, new Date().toISOString());
  } catch {}
}

export async function hasPendingVaultSync() {
  try {
    const v = await AsyncStorage.getItem(PENDING_VAULT_SYNC_KEY);
    return !!v;
  } catch {
    return false;
  }
}

export async function getLastVaultSyncTimestamp() {
  try {
    return await AsyncStorage.getItem(LAST_VAULT_SYNC_KEY);
  } catch {
    return null;
  }
}

export async function triggerBackgroundVaultSync() {
  if (isImportingVault) return;
  syncVaultToNativeAutofill().catch(() => {});
  try {
    const raw = await SecureStore.getItemAsync('auth_credentials');
    if (raw) {
      const creds = JSON.parse(raw);
      if (creds && creds.password) {
        const { syncVaultToServer } = require('./vault');
        const ok = await syncVaultToServer(creds.password, creds.identifier, creds.email);
        if (!ok) {
          await markPendingVaultSync();
        }
      }
    }
  } catch {
    await markPendingVaultSync();
  }
}
