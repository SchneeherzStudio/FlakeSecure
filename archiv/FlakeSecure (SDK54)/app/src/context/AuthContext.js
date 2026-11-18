/**
 * ============================================================================
 * FlakeSecure Mobile App - Authentication Context & Provider v2.1
 * ============================================================================
 */

export default {};

import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  register as apiRegister,
  login as apiLogin,
  logout as apiLogout,
  getMe,
  getIsOffline,
  subscribeConnectivity,
} from '../utils/api';
import { syncVaultFromServer, syncVaultToServer, purgeLocalVault } from '../utils/vault';
import { hasLocalVaultData } from '../utils/storage';
import { unregisterDevicePushNotifications } from '../utils/notifications';
import { toast } from '../components/Toast';
import { i18n } from '../i18n';

const AuthContext = createContext(null);
const CACHED_USER_KEY = 'flakesecure_cached_user_v1';

async function loadCachedUser() {
  try {
    const raw = await SecureStore.getItemAsync(CACHED_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  try {
    const credsRaw = await SecureStore.getItemAsync('auth_credentials');
    if (credsRaw) {
      const parsed = JSON.parse(credsRaw);
      return {
        username: parsed.username || parsed.identifier || 'User',
        email: parsed.email || parsed.identifier || '',
        offline: true,
      };
    }
  } catch {}
  return null;
}

async function saveCachedUser(userObj) {
  if (!userObj) return;
  try {
    await SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(userObj));
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsBiometricUnlock, setNeedsBiometricUnlock] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(getIsOffline());
  const [hasSavedBiometricCredentials, setHasSavedBiometricCredentials] = useState(false);

  const isAuthenticated = !!user && !!token;

  useEffect(() => {
    const unsub = subscribeConnectivity((offline) => {
      setIsOfflineMode(offline);
    });
    return unsub;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedCredentials, localHasData] = await Promise.all([
          SecureStore.getItemAsync('auth_token'),
          SecureStore.getItemAsync('auth_credentials'),
          hasLocalVaultData(),
        ]);

        setHasSavedBiometricCredentials(!!(savedCredentials || localHasData));

        if (savedToken) {
          setToken(savedToken);
          const data = await getMe();
          setUser(data.user);
          await saveCachedUser(data.user);
          setIsOfflineMode(false);
        } else if (savedCredentials) {
          setNeedsBiometricUnlock(true);
        }
      } catch (err) {
        const isExplicitAuthReject = err?.status === 401 || err?.status === 403;
        if (isExplicitAuthReject) {
          console.log('[Auth] Token rejected (401/403), clearing token:', err.message);
          await SecureStore.deleteItemAsync('auth_token');
          setToken(null);
          setUser(null);

          try {
            const savedCredentials = await SecureStore.getItemAsync('auth_credentials');
            if (savedCredentials) {
              setNeedsBiometricUnlock(true);
            }
          } catch {}
        } else {
          // Network/offline error or server 5xx -> NEVER delete auth_token or auth_credentials!
          console.log('[Auth] Offline/Network startup detected:', err.message);
          setIsOfflineMode(true);
          try {
            const savedCredentials = await SecureStore.getItemAsync('auth_credentials');
            const cachedUser = await loadCachedUser();
            if (savedCredentials) {
              // Require biometric unlock before exposing offline vault
              setToken(null);
              setUser(null);
              setNeedsBiometricUnlock(true);
            } else if (cachedUser) {
              const savedToken = await SecureStore.getItemAsync('auth_token');
              setToken(savedToken || 'offline_local_token');
              setUser({ ...cachedUser, offline: true });
            }
          } catch {}
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const biometricUnlock = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        await SecureStore.deleteItemAsync('auth_credentials');
        setNeedsBiometricUnlock(false);
        return { success: false, reason: 'no_hardware' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: i18n.t('biometricUnlock.unlockBtn') || 'Unlock FlakeSecure',
        fallbackLabel: i18n.t('biometricUnlock.usePassword') || 'Use password',
      });

      if (result.success) {
        const savedCredentials = await SecureStore.getItemAsync('auth_credentials');
        if (savedCredentials) {
          const { identifier, password, email, username } = JSON.parse(savedCredentials);
          try {
            const data = await apiLogin(identifier, password);
            await SecureStore.setItemAsync('auth_token', data.token);
            await SecureStore.setItemAsync(
              'auth_credentials',
              JSON.stringify({
                identifier,
                email: data.user?.email || email || identifier,
                username: data.user?.username || username || identifier,
                password,
              })
            );
            await saveCachedUser(data.user);
            setToken(data.token);
            setUser(data.user);
            setIsOfflineMode(false);
            setNeedsBiometricUnlock(false);

            try {
              await syncVaultFromServer(password, identifier, data.user?.email || email);
            } catch (syncErr) {
              console.log('[Auth] Biometric vault sync warning:', syncErr.message);
            }

            return { success: true, offline: false };
          } catch (loginErr) {
            const isExplicitAuthReject =
              loginErr?.status === 401 || loginErr?.status === 403;
            if (isExplicitAuthReject) {
              console.log('[Auth] Biometric credentials rejected (401/403):', loginErr.message);
              await SecureStore.deleteItemAsync('auth_credentials');
              await SecureStore.deleteItemAsync('auth_token');
              setHasSavedBiometricCredentials(false);
              setNeedsBiometricUnlock(false);
              return {
                success: false,
                reason: 'invalid_credentials',
                error: loginErr.message,
              };
            }

            // Offline / Network / Server 5xx fallback -> Unlock local vault!
            console.log('[Auth] Unlocking local vault in offline mode:', loginErr.message);
            const savedToken = await SecureStore.getItemAsync('auth_token');
            const cachedUser = (await loadCachedUser()) || {
              username: username || identifier || 'User',
              email: email || identifier || '',
              offline: true,
            };
            setToken(savedToken || 'offline_local_token');
            setUser({ ...cachedUser, offline: true });
            setIsOfflineMode(true);
            setNeedsBiometricUnlock(false);
            toast.warn(i18n.t('offline.unlockedOfflineToast'));
            return { success: true, offline: true };
          }
        }
      }
      return { success: false, reason: 'cancelled' };
    } catch (err) {
      console.log('[Auth] Biometric unlock error:', err.message);
      return { success: false, reason: 'error', error: err.message };
    }
  }, []);

  const unlockLocalVaultOffline = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: i18n.t('biometricUnlock.unlockBtn') || 'Unlock FlakeSecure',
          fallbackLabel: i18n.t('biometricUnlock.usePassword') || 'Use password',
        });
        if (!result.success) {
          return { success: false, reason: 'cancelled' };
        }
      }

      const savedToken = await SecureStore.getItemAsync('auth_token');
      const cachedUser = (await loadCachedUser()) || {
        username: 'Offline Vault',
        email: '',
        offline: true,
      };
      setToken(savedToken || 'offline_local_token');
      setUser({ ...cachedUser, offline: true });
      setIsOfflineMode(true);
      setNeedsBiometricUnlock(false);
      toast.warn(i18n.t('offline.unlockedOfflineToast'));
      return { success: true, offline: true };
    } catch (err) {
      return { success: false, reason: 'error', error: err.message };
    }
  }, []);

  const switchToPasswordLogin = useCallback(async () => {
    setToken(null);
    setUser(null);
    setNeedsBiometricUnlock(false);
  }, []);

  const register = useCallback(async (email, username, password, otpToken = null) => {
    const data = await apiRegister(email, username, password, otpToken);
    await SecureStore.setItemAsync('auth_token', data.token);
    await SecureStore.setItemAsync(
      'auth_credentials',
      JSON.stringify({
        identifier: email,
        email: data.user?.email || email,
        username: data.user?.username || username,
        password,
      })
    );
    await saveCachedUser(data.user);
    setHasSavedBiometricCredentials(true);
    setToken(data.token);
    setUser(data.user);
    setIsOfflineMode(false);
    setNeedsBiometricUnlock(false);

    try {
      await syncVaultToServer(password, email, data.user?.email || email);
    } catch (syncErr) {
      console.log('[Auth] Register vault sync warning:', syncErr.message);
    }

    return data;
  }, []);

  const login = useCallback(async (identifier, password) => {
    const data = await apiLogin(identifier, password);
    await SecureStore.setItemAsync('auth_token', data.token);
    await SecureStore.setItemAsync(
      'auth_credentials',
      JSON.stringify({
        identifier,
        email: data.user?.email || identifier,
        username: data.user?.username || identifier,
        password,
      })
    );
    await saveCachedUser(data.user);
    setHasSavedBiometricCredentials(true);

    await AsyncStorage.setItem('pending_vault_pull_check', 'true');

    setToken(data.token);
    setUser(data.user);
    setIsOfflineMode(false);
    setNeedsBiometricUnlock(false);

    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await unregisterDevicePushNotifications();
    } catch {}
    try {
      await apiLogout();
    } catch (err) {
      console.log('[Auth] Logout API error (clearing locally):', err.message);
    }

    await purgeLocalVault();
    await SecureStore.deleteItemAsync('auth_token').catch(() => {});
    await SecureStore.deleteItemAsync('auth_credentials').catch(() => {});
    await SecureStore.deleteItemAsync(CACHED_USER_KEY).catch(() => {});
    setHasSavedBiometricCredentials(false);
    setToken(null);
    setUser(null);
    setNeedsBiometricUnlock(false);
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
    saveCachedUser(updatedUser);
  }, []);

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    needsBiometricUnlock,
    isOfflineMode,
    hasSavedBiometricCredentials,
    biometricUnlock,
    unlockLocalVaultOffline,
    switchToPasswordLogin,
    register,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
