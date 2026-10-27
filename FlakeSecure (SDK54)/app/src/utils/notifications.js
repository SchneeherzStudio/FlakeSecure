import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoCrypto from 'expo-crypto';
import Constants from 'expo-constants';
import {
  registerPushToken,
  unregisterPushToken,
  updatePushPreferences,
  getPushStatus,
  fetchPwnedRange,
  getDeviceModelName,
  getIsOffline,
} from './api';
import {
  getAllCredentials,
  getCards,
  getCardExpiryStatus,
  getLastVaultSyncTimestamp,
} from './storage';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const PUSH_TOKEN_STORAGE_KEY = 'flakesecure_expo_push_token_v1';
const SERVER_PUSH_PREFS_KEY = 'flakesecure_server_push_prefs_v1';
const LOCAL_NOTIF_PREFS_KEY = 'flakesecure_local_notif_prefs_v1';
const NOTIFIED_CARDS_KEY = 'flakesecure_notified_cards_v1';
const LAST_WEEKLY_REPORT_KEY = 'flakesecure_last_weekly_security_report_v1';
const LAST_BREACH_CHECK_KEY = 'flakesecure_last_breach_check_v1';
const LAST_BACKUP_REMINDER_KEY = 'flakesecure_last_backup_reminder_v1';

export const DEFAULT_SERVER_PUSH_PREFS = {
  new_device_login: true,
  failed_login_attempts: true,
  share_events: true,
  share_expiring: true,
  vault_sync_conflict: true,
};

export const DEFAULT_LOCAL_NOTIF_PREFS = {
  card_expiry: true,
  breach_check: true,
  weak_passwords: true,
  backup_reminder: true,
};

export const DEFAULT_LOCAL_NOTIFICATION_PREFS = DEFAULT_LOCAL_NOTIF_PREFS;

let handlerInitialized = false;

export function configureNotificationsHandler() {
  if (handlerInitialized || !Notifications) return;
  handlerInitialized = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
      Notifications.setNotificationChannelAsync('flakesecure-security', {
        name: 'FlakeSecure Security & Vault',
        importance: Notifications.AndroidImportance?.HIGH || 4,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#E8B020',
      }).catch(() => {});
    }
  } catch {}
}

export async function getServerPushPrefs() {
  try {
    const raw = await AsyncStorage.getItem(SERVER_PUSH_PREFS_KEY);
    if (raw) {
      return { ...DEFAULT_SERVER_PUSH_PREFS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_SERVER_PUSH_PREFS };
}

export async function saveServerPushPrefs(prefs, language = null) {
  const merged = { ...DEFAULT_SERVER_PUSH_PREFS, ...(prefs || {}) };
  try {
    await AsyncStorage.setItem(SERVER_PUSH_PREFS_KEY, JSON.stringify(merged));
  } catch {}
  if (!getIsOffline()) {
    try {
      await updatePushPreferences(merged, language);
    } catch {}
  }
  return merged;
}

export async function syncServerPushPrefsFromBackend() {
  if (getIsOffline()) return await getServerPushPrefs();
  try {
    const status = await getPushStatus();
    if (status?.preferences && typeof status.preferences === 'object') {
      const merged = { ...DEFAULT_SERVER_PUSH_PREFS, ...status.preferences };
      await AsyncStorage.setItem(SERVER_PUSH_PREFS_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch {}
  return await getServerPushPrefs();
}

export async function getLocalNotificationPrefs() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_NOTIF_PREFS_KEY);
    if (raw) {
      return { ...DEFAULT_LOCAL_NOTIF_PREFS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_LOCAL_NOTIF_PREFS };
}

export async function saveLocalNotificationPrefs(prefs) {
  const merged = { ...DEFAULT_LOCAL_NOTIF_PREFS, ...(prefs || {}) };
  try {
    await AsyncStorage.setItem(LOCAL_NOTIF_PREFS_KEY, JSON.stringify(merged));
  } catch {}
  return merged;
}

export async function registerDeviceForPushNotifications(language = 'de') {
  configureNotificationsHandler();
  if (!Notifications || Platform.OS === 'web') return null;

  try {
    const existingPerm = await Notifications.getPermissionsAsync();
    let finalStatus = existingPerm?.status;
    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested?.status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      '28264741-e312-4036-b856-58b054137bc1';

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoToken = tokenRes?.data;
    if (!expoToken) return null;

    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoToken);

    if (!getIsOffline()) {
      const prefs = await getServerPushPrefs();
      await registerPushToken(expoToken, getDeviceModelName(), language, prefs).catch(
        () => {}
      );
    }
    return expoToken;
  } catch {
    return null;
  }
}

export async function unregisterDevicePushNotifications() {
  try {
    const savedToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (savedToken && !getIsOffline()) {
      await unregisterPushToken(savedToken).catch(() => {});
    }
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {}
}

export async function scheduleLocalSecurityNotification(title, body, data = {}) {
  configureNotificationsHandler();
  if (!Notifications || !Notifications.scheduleNotificationAsync) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

function isPasswordWeak(pw) {
  const s = String(pw || '');
  if (s.length < 10) return true;
  let classes = 0;
  if (/[a-z]/.test(s)) classes++;
  if (/[A-Z]/.test(s)) classes++;
  if (/[0-9]/.test(s)) classes++;
  if (/[^a-zA-Z0-9]/.test(s)) classes++;
  return classes < 3;
}

export async function runLocalSecurityNotificationsCheck(tFn, options = {}) {
  const force = !!options.force;
  const prefs = await getLocalNotificationPrefs();
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
  const FOURTEEN_DAYS_MS = 14 * ONE_DAY_MS;

  const summary = {
    cardExpiringCount: 0,
    breachCount: 0,
    weakCount: 0,
    reusedCount: 0,
    backupOverdue: false,
  };

  const tr = (key, params) => {
    if (typeof tFn === 'function') {
      return tFn(key, params);
    }
    return key;
  };

  // D. Card Expiry Reminder (within 30 days)
  if (prefs.card_expiry || force) {
    try {
      const cards = await getCards();
      const notifiedRaw = await AsyncStorage.getItem(NOTIFIED_CARDS_KEY);
      const notifiedMap = notifiedRaw ? JSON.parse(notifiedRaw) : {};
      const currentMonthBucket = new Date().toISOString().slice(0, 7);

      for (const card of cards) {
        const status = getCardExpiryStatus(card.expiryMonth, card.expiryYear);
        if (status.isExpiringSoon || status.isExpired) {
          summary.cardExpiringCount++;
          const dedupeKey = `${card.id}_${status.formatted}`;
          if (force || notifiedMap[dedupeKey] !== currentMonthBucket) {
            notifiedMap[dedupeKey] = currentMonthBucket;
            await scheduleLocalSecurityNotification(
              tr('notifications.cardExpiringTitle'),
              tr('notifications.cardExpiringBody', {
                label: card.label || 'Card',
                expiry: status.formatted,
              }),
              { targetScreen: 'Home:cards', cardId: card.id }
            );
          }
        }
      }
      await AsyncStorage.setItem(NOTIFIED_CARDS_KEY, JSON.stringify(notifiedMap));
    } catch {}
  }

  // Load credentials for E & F
  let credentials = [];
  try {
    credentials = await getAllCredentials();
  } catch {}

  // E. HaveIBeenPwned k-Anonymity Breach Check
  if ((prefs.breach_check || force) && !getIsOffline() && credentials.length > 0) {
    try {
      const lastBreachRaw = await AsyncStorage.getItem(LAST_BREACH_CHECK_KEY);
      const lastBreachTs = lastBreachRaw ? parseInt(lastBreachRaw, 10) : 0;
      if (force || now - lastBreachTs > ONE_DAY_MS) {
        const uniquePasswords = [
          ...new Set(
            credentials
              .map((c) => c.password)
              .filter((pw) => typeof pw === 'string' && pw.length > 0)
          ),
        ].slice(0, 25);

        const prefixMap = new Map();
        for (const pw of uniquePasswords) {
          const sha1 = (
            await ExpoCrypto.digestStringAsync(
              ExpoCrypto.CryptoDigestAlgorithm.SHA1,
              pw
            )
          ).toUpperCase();
          const prefix = sha1.slice(0, 5);
          const suffix = sha1.slice(5);
          if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
          prefixMap.get(prefix).push(suffix);
        }

        let breachedPasswords = 0;
        for (const [prefix, suffixes] of prefixMap.entries()) {
          try {
            const rangeText = await fetchPwnedRange(prefix);
            const lines = String(rangeText || '').split(/\r?\n/);
            const suffixSet = new Set(
              lines.map((line) => line.split(':')[0]?.trim()?.toUpperCase()).filter(Boolean)
            );
            for (const sfx of suffixes) {
              if (suffixSet.has(sfx)) {
                breachedPasswords++;
              }
            }
          } catch {}
        }

        summary.breachCount = breachedPasswords;
        await AsyncStorage.setItem(LAST_BREACH_CHECK_KEY, String(now));

        if (breachedPasswords > 0) {
          await scheduleLocalSecurityNotification(
            tr('notifications.breachFoundTitle'),
            tr('notifications.breachFoundBody', { count: breachedPasswords }),
            { targetScreen: 'Home' }
          );
        }
      }
    } catch {}
  }

  // F. Weak / Reused Passwords Weekly Report
  if ((prefs.weak_passwords || force) && credentials.length > 0) {
    try {
      const freq = new Map();
      let weakCount = 0;
      for (const cred of credentials) {
        const pw = String(cred.password || '');
        if (!pw) continue;
        if (isPasswordWeak(pw)) weakCount++;
        freq.set(pw, (freq.get(pw) || 0) + 1);
      }
      let reusedCount = 0;
      for (const count of freq.values()) {
        if (count > 1) reusedCount += count;
      }

      summary.weakCount = weakCount;
      summary.reusedCount = reusedCount;

      const lastWeeklyRaw = await AsyncStorage.getItem(LAST_WEEKLY_REPORT_KEY);
      const lastWeeklyTs = lastWeeklyRaw ? parseInt(lastWeeklyRaw, 10) : 0;

      if (
        (weakCount > 0 || reusedCount > 0) &&
        (force || now - lastWeeklyTs > SEVEN_DAYS_MS)
      ) {
        await AsyncStorage.setItem(LAST_WEEKLY_REPORT_KEY, String(now));
        await scheduleLocalSecurityNotification(
          tr('notifications.weakPasswordsTitle'),
          tr('notifications.weakPasswordsBody', {
            weak: weakCount,
            reused: reusedCount,
          }),
          { targetScreen: 'Home' }
        );
      }
    } catch {}
  }

  // H. Vault Backup / Sync Reminder (>14 days)
  if ((prefs.backup_reminder || force) && credentials.length > 0) {
    try {
      const lastSyncIso = await getLastVaultSyncTimestamp();
      const lastSyncTs = lastSyncIso ? new Date(lastSyncIso).getTime() : 0;
      if (lastSyncTs > 0 && now - lastSyncTs > FOURTEEN_DAYS_MS) {
        summary.backupOverdue = true;
        const lastRemRaw = await AsyncStorage.getItem(LAST_BACKUP_REMINDER_KEY);
        const lastRemTs = lastRemRaw ? parseInt(lastRemRaw, 10) : 0;
        if (force || now - lastRemTs > SEVEN_DAYS_MS) {
          await AsyncStorage.setItem(LAST_BACKUP_REMINDER_KEY, String(now));
          await scheduleLocalSecurityNotification(
            tr('notifications.backupReminderTitle'),
            tr('notifications.backupReminderBody'),
            { targetScreen: 'Settings' }
          );
        }
      }
    } catch {}
  }

  return summary;
}
