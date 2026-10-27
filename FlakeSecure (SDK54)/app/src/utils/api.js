/**
 * ============================================================================
 * FlakeSecure Mobile App - API Client Utility v2.1
 * ============================================================================
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const DEFAULT_SERVER_URL = 'https://flakesecure.snowystudio.dev';
export const DEFAULT_SERVER = DEFAULT_SERVER_URL;

let isOfflineState = false;
const connectivityListeners = new Set();

export function getIsOffline() {
  return isOfflineState;
}

export function reportNetworkStatus(isOnline) {
  const nextOffline = !isOnline;
  if (isOfflineState !== nextOffline) {
    isOfflineState = nextOffline;
    connectivityListeners.forEach((cb) => {
      try {
        cb(isOfflineState);
      } catch {}
    });
  }
}

export function subscribeConnectivity(listener) {
  if (typeof listener !== 'function') return () => {};
  connectivityListeners.add(listener);
  return () => {
    connectivityListeners.delete(listener);
  };
}

export async function checkServerReachability(timeoutMs = 6000) {
  try {
    const serverUrl = await getServerUrl();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetch(`${serverUrl}/api/system/status`, {
        method: 'GET',
        signal: controller?.signal,
      });
      if (timer) clearTimeout(timer);
      const reachable = res.status < 500;
      reportNetworkStatus(reachable);
      return reachable;
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    reportNetworkStatus(false);
    return false;
  }
}

export function getDeviceModelName() {
  if (Platform.OS === 'ios') {
    const isPad = Platform.isPad;
    const sysVer = Platform.Version ? ` ${Platform.Version}` : '';
    return `Apple ${isPad ? 'iPad' : 'iPhone'} (iOS${sysVer})`;
  } else if (Platform.OS === 'android') {
    const brand = Platform.constants?.Brand || '';
    const model = Platform.constants?.Model || 'Android Phone';
    const cleanBrand = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : '';
    const release = Platform.constants?.Release ? ` ${Platform.constants.Release}` : '';
    return `${cleanBrand} ${model} (Android${release})`.trim();
  }
  return `${Platform.OS.toUpperCase()} Device`;
}

export async function getServerUrl() {
  const url = await SecureStore.getItemAsync('server_url');
  return url || DEFAULT_SERVER_URL;
}

export async function getToken() {
  return await SecureStore.getItemAsync('auth_token');
}

export async function apiRequest(endpoint, options = {}) {
  const serverUrl = await getServerUrl();
  const token = await getToken();

  const headers = {
    'Content-Type': 'application/json',
    'x-device-name': getDeviceModelName(),
    ...options.headers,
  };

  if (token && token !== 'offline_local_token') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const timeoutMs = options.timeoutMs || 12000;
  const controller =
    typeof AbortController !== 'undefined' && !options.signal ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response;
  try {
    response = await fetch(`${serverUrl}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal || controller?.signal,
    });
  } catch (networkErr) {
    if (timeoutId) clearTimeout(timeoutId);
    reportNetworkStatus(false);
    const err = new Error(networkErr?.message || 'Network request failed');
    err.isNetworkError = true;
    err.code = 'NETWORK_ERROR';
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  reportNetworkStatus(true);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.error || `HTTP ${response.status}`);
    err.status = response.status;
    if (data.code) err.code = data.code;
    if (data.errors) err.errors = data.errors;
    if (response.status === 429) {
      const retryHeader = response.headers?.get?.('retry-after');
      const parsedRetry = parseInt(data.retryAfter || retryHeader || '30', 10);
      err.retryAfter = Number.isFinite(parsedRetry) && parsedRetry > 0 ? parsedRetry : 30;
    }
    throw err;
  }

  return data;
}

export async function getPasswordPolicy() {
  return apiRequest('/api/auth/password-policy');
}

export async function fetchPwnedRange(prefix) {
  const serverUrl = await getServerUrl();
  const cleanPrefix = String(prefix || '').trim().toUpperCase().slice(0, 5);
  const response = await fetch(`${serverUrl}/api/security/pwned-range/${cleanPrefix}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.text();
}

export async function register(email, username, password, otpToken = null) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      username,
      password,
      otpToken,
      device_info: getDeviceModelName(),
    }),
  });
}

export async function login(identifier, password) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier,
      password,
      device_info: getDeviceModelName(),
    }),
  });
}

export async function logout() {
  return apiRequest('/api/auth/logout', { method: 'POST' });
}

export async function getMe() {
  return apiRequest('/api/auth/me');
}

export async function deleteAccount(otpToken = null) {
  return apiRequest('/api/account/delete', {
    method: 'DELETE',
    body: JSON.stringify({ otpToken }),
  });
}

export async function updateAccount(data) {
  return apiRequest('/api/account/update', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getRestrictions() {
  return apiRequest('/api/account/restrictions');
}

export async function addRestriction(username) {
  return apiRequest('/api/account/restrictions', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export async function removeRestriction(recipientId) {
  return apiRequest(`/api/account/restrictions/${recipientId}`, {
    method: 'DELETE',
  });
}

export async function searchUsers(query) {
  return apiRequest(`/api/account/search?q=${encodeURIComponent(query)}`);
}

export async function getSessions() {
  return apiRequest('/api/account/sessions');
}

export async function deleteSession(sessionId) {
  return apiRequest(`/api/account/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function getSystemStatus() {
  return apiRequest('/api/system/status');
}

export async function getAnnouncements() {
  return apiRequest('/api/system/announcements');
}

export async function dismissAnnouncement(id) {
  return apiRequest(`/api/system/announcements/${id}/dismiss`, {
    method: 'POST',
  });
}

export async function sendOtp(email, purpose = 'register') {
  return apiRequest('/api/otp/send', {
    method: 'POST',
    body: JSON.stringify({ email, purpose }),
  });
}

export async function verifyOtp(email, code, purpose = 'register') {
  return apiRequest('/api/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code, purpose }),
  });
}

export async function getVault() {
  return apiRequest('/api/vault/sync');
}

export async function syncVault(encryptedBlob, blobVersion = 1) {
  return apiRequest('/api/vault/sync', {
    method: 'PUT',
    body: JSON.stringify({ encrypted_blob: encryptedBlob, blob_version: blobVersion }),
  });
}

export async function purgeVault() {
  return apiRequest('/api/vault/purge', {
    method: 'DELETE',
  });
}

export async function registerPushToken(
  expoToken,
  deviceInfo = '',
  language = 'de',
  preferences = null
) {
  return apiRequest('/api/notifications/register', {
    method: 'POST',
    body: JSON.stringify({
      expo_token: expoToken,
      device_info: deviceInfo || getDeviceModelName(),
      language,
      ...(preferences ? { preferences } : {}),
    }),
  });
}

export async function updatePushPreferences(preferences, language = null) {
  return apiRequest('/api/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify({
      preferences,
      ...(language ? { language } : {}),
    }),
  });
}

export async function unregisterPushToken(expoToken) {
  return apiRequest('/api/notifications/unregister', {
    method: 'DELETE',
    body: JSON.stringify({ expo_token: expoToken }),
  });
}

export async function getPushStatus() {
  return apiRequest('/api/notifications/status');
}

export async function sendLogin(sid, payload) {
  const serverUrl = await getServerUrl();
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token && token !== 'offline_local_token') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${serverUrl}/send-login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sid, payload }),
  });
  return await response.json();
}

export async function sendTotp(sid, payload) {
  const serverUrl = await getServerUrl();
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token && token !== 'offline_local_token') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${serverUrl}/send-totp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sid, payload }),
  });
  return await response.json();
}

export const notifyQrScanned = async (sid, username) => {
  const serverUrl = await getServerUrl();
  try {
    await fetch(`${serverUrl}/qr-scanned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid, username }),
    });
  } catch (e) {
    // Fire-and-forget, don't block scan flow
  }
};

export async function getLogs(page = 1, limit = 20) {
  return apiRequest(`/api/logs?page=${page}&limit=${limit}`);
}

export async function clearLogs() {
  return apiRequest('/api/logs/clear', { method: 'DELETE' });
}
