/**
 * ============================================================================
 * FlakeSecure Mobile App - API Client Utility
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
 *    - register(email, username, password), login(identifier, password), logout(), getMe()
 * 
 * 3. ACCOUNT & SHARING METHODS:
 *    - deleteAccount(), updateAccount(data), getRestrictions(), addRestriction(username), removeRestriction(recipientId), searchUsers(query)
 * 
 * 4. LOGS METHODS:
 *    - getLogs(page, limit), clearLogs()
 * ============================================================================
 */

export default {};

import * as SecureStore from 'expo-secure-store';

const DEFAULT_SERVER_URL = 'https://flakesecure.snowystudio.dev';

async function getServerUrl() {
  const url = await SecureStore.getItemAsync('server_url');
  return url || DEFAULT_SERVER_URL;
}

async function getToken() {
  return await SecureStore.getItemAsync('auth_token');
}

async function apiRequest(endpoint, options = {}) {
  const serverUrl = await getServerUrl();
  const token = await getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${serverUrl}${endpoint}`, {
    ...options,
    headers,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  
  return data;
}

export async function register(email, username, password) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  });
}

export async function login(identifier, password) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export async function logout() {
  return apiRequest('/api/auth/logout', { method: 'POST' });
}

export async function getMe() {
  return apiRequest('/api/auth/me');
}

export async function deleteAccount() {
  return apiRequest('/api/account/delete', { method: 'DELETE' });
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

export async function getLogs(page = 1, limit = 20) {
  return apiRequest(`/api/logs?page=${page}&limit=${limit}`);
}

export async function clearLogs() {
  return apiRequest('/api/logs/clear', { method: 'DELETE' });
}
