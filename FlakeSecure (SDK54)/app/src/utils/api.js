/**
 * ============================================================================
 * FlakeSecure Mobile App - API Client Utility v2.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. HTTP CLIENT & AUTH HEADERS:
 *    - getServerUrl(): Reads configured server URL from SecureStore (fallback: DEFAULT_SERVER_URL).
 *    - getToken(): Retrieves stored JWT token from SecureStore.
 *    - apiRequest(endpoint, options): Executes HTTP requests with automatic Bearer token injection and error handling.
 * 
 * 2. AUTH METHODS:
 *    - register(email, username, password, otpToken), login(identifier, password), logout(), getMe()
 * 
 * 3. ACCOUNT & SHARING METHODS:
 *    - deleteAccount(otpToken), updateAccount(data), getRestrictions(), addRestriction(username), removeRestriction(recipientId), searchUsers(query)
 *    - getSessions(), deleteSession(sessionId)
 * 
 * 4. SYSTEM & ANNOUNCEMENT METHODS:
 *    - getSystemStatus(), getAnnouncements(), dismissAnnouncement(id)
 * 
 * 5. OTP VERIFICATION METHODS:
 *    - sendOtp(email, purpose), verifyOtp(email, code, purpose)
 * 
 * 6. VAULT SYNC METHODS:
 *    - getVault(), syncVault(encryptedBlob, blobVersion), purgeVault()
 * 
 * 7. PUSH NOTIFICATION METHODS:
 *    - registerPushToken(expoToken, deviceInfo), unregisterPushToken(expoToken), getPushStatus()
 * 
 * 8. RELAY & TOTP STREAMING METHODS:
 *    - sendLogin(sid, payload), sendTotp(sid, payload)
 * 
 * 9. LOGS METHODS:
 *    - getLogs(page, limit), clearLogs()
 * ============================================================================
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEFAULT_SERVER_URL = 'https://flakesecure.snowystudio.dev';

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
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${serverUrl}${endpoint}`, {
    ...options,
    headers,
  });
  
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  
  return data;
}

export async function register(email, username, password, otpToken = null) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password, otpToken, device_info: getDeviceModelName() }),
  });
}

export async function login(identifier, password) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, device_info: getDeviceModelName() }),
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

export async function registerPushToken(expoToken, deviceInfo = '') {
  return apiRequest('/api/notifications/register', {
    method: 'POST',
    body: JSON.stringify({ expo_token: expoToken, device_info: deviceInfo }),
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
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
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
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const response = await fetch(`${serverUrl}/send-totp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sid, payload }),
  });
  return await response.json();
}

export async function getLogs(page = 1, limit = 20) {
  return apiRequest(`/api/logs?page=${page}&limit=${limit}`);
}

export async function clearLogs() {
  return apiRequest('/api/logs/clear', { method: 'DELETE' });
}
