import { NativeModules, Platform } from 'react-native';

const NativeAutofill = NativeModules?.FlakeSecureAutofill || null;

export function isAutofillSupported() {
  if (Platform.OS !== 'android') return false;
  if (typeof Platform.Version === 'number' && Platform.Version < 26) return false;
  return true;
}

export async function isAutofillEnabled() {
  if (!isAutofillSupported() || !NativeAutofill?.isAutofillEnabled) {
    return false;
  }
  try {
    return !!(await NativeAutofill.isAutofillEnabled());
  } catch {
    return false;
  }
}

export async function openAutofillSettings() {
  if (!isAutofillSupported() || !NativeAutofill?.openAutofillSettings) {
    return false;
  }
  try {
    return !!(await NativeAutofill.openAutofillSettings());
  } catch {
    return false;
  }
}

export async function syncVaultToNativeAutofill(preloadedData = null) {
  if (!isAutofillSupported() || !NativeAutofill?.syncVaultForAutofill) {
    return false;
  }
  try {
    let credentials = preloadedData?.credentials;
    let cards = preloadedData?.cards;
    if (!credentials || !cards) {
      const storage = require('./storage');
      credentials = await storage.getAllCredentials();
      cards = await storage.getCards();
    }

    const payload = {
      updatedAt: new Date().toISOString(),
      credentials: (credentials || []).map((c) => ({
        domain: c.domain || '',
        username: c.username || '',
        password: c.password || '',
        totpSecret: c.totpSecret || null,
      })),
      cards: (cards || []).map((card) => ({
        id: card.id,
        label: card.label || '',
        cardholderName: card.cardholderName || '',
        number: card.number || '',
        expiryMonth: card.expiryMonth || '',
        expiryYear: card.expiryYear || '',
        cvv: card.cvv || '',
        brand: card.brand || 'other',
      })),
    };

    await NativeAutofill.syncVaultForAutofill(JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('syncVaultToNativeAutofill failed:', err);
    return false;
  }
}

export async function importPendingAutofillSaves() {
  if (!isAutofillSupported() || !NativeAutofill?.consumePendingSavedCredentials) {
    return 0;
  }
  try {
    const rawJson = await NativeAutofill.consumePendingSavedCredentials();
    if (!rawJson) return 0;
    const items = JSON.parse(rawJson);
    if (!Array.isArray(items) || items.length === 0) return 0;

    const storage = require('./storage');
    let importedCount = 0;
    for (const item of items) {
      const domain = String(item?.domain || '').trim();
      const username = String(item?.username || '').trim();
      const password = String(item?.password || '');
      if (domain && (username || password)) {
        await storage.saveCredentials(domain, username, password);
        importedCount++;
      }
    }
    if (importedCount > 0) {
      await syncVaultToNativeAutofill();
    }
    return importedCount;
  } catch (err) {
    console.warn('importPendingAutofillSaves failed:', err);
    return 0;
  }
}
