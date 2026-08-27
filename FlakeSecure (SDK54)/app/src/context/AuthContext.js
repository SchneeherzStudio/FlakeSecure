/**
 * ============================================================================
 * FlakeSecure Mobile App - Authentication Context & Provider
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. STATE MANAGEMENT & AUTO-LOGIN:
 *    - Checks for saved tokens (auth_token) in SecureStore upon app startup.
 *    - Fetches the user profile via getMe() or enters biometric unlock mode (needsBiometricUnlock).
 * 
 * 2. BIOMETRIC UNLOCK (biometricUnlock):
 *    - Performs local biometric authentication (Face ID / Fingerprint) via LocalAuthentication.
 *    - Decrypts stored credentials from SecureStore and refreshes the session token via the login API.
 * 
 * 3. AUTHENTICATION ACTIONS:
 *    - register(email, username, password): Registers user, stores token and credentials in SecureStore.
 *    - login(identifier, password): Authenticates user and caches session data in SecureStore.
 *    - logout(): Logs out from server and cleans up local tokens and stored credentials.
 *    - switchToPasswordLogin(): Resets biometric prompt state and clears cached session keys.
 *    - updateUser(user): Updates the local user profile object in context.
 * ============================================================================
 */

export default {};

import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { register as apiRegister, login as apiLogin, logout as apiLogout, getMe } from '../utils/api';
import { i18n } from '../i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsBiometricUnlock, setNeedsBiometricUnlock] = useState(false);

  const isAuthenticated = !!user && !!token;

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await SecureStore.getItemAsync('auth_token');
        if (savedToken) {
          setToken(savedToken);
          const data = await getMe();
          setUser(data.user);
        } else {
          const savedCredentials = await SecureStore.getItemAsync('auth_credentials');
          if (savedCredentials) {
            setNeedsBiometricUnlock(true);
          }
        }
      } catch (err) {
        console.log('[Auth] Auto-login failed:', err.message);
        await SecureStore.deleteItemAsync('auth_token');
        setToken(null);
        setUser(null);
        
        try {
          const savedCredentials = await SecureStore.getItemAsync('auth_credentials');
          if (savedCredentials) {
            setNeedsBiometricUnlock(true);
          }
        } catch (e) {}
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
          const { identifier, password } = JSON.parse(savedCredentials);
          try {
            const data = await apiLogin(identifier, password);
            await SecureStore.setItemAsync('auth_token', data.token);
            setToken(data.token);
            setUser(data.user);
            setNeedsBiometricUnlock(false);
            return { success: true };
          } catch (loginErr) {
            console.log('[Auth] Biometric auto-login failed on server:', loginErr.message);
            await SecureStore.deleteItemAsync('auth_credentials');
            await SecureStore.deleteItemAsync('auth_token');
            setNeedsBiometricUnlock(false);
            return { success: false, reason: 'invalid_credentials', error: loginErr.message };
          }
        }
      }
      return { success: false, reason: 'cancelled' };
    } catch (err) {
      console.log('[Auth] Biometric unlock error:', err.message);
      return { success: false, reason: 'error', error: err.message };
    }
  }, []);

  const switchToPasswordLogin = useCallback(async () => {
    await SecureStore.deleteItemAsync('auth_credentials');
    await SecureStore.deleteItemAsync('auth_token');
    setToken(null);
    setUser(null);
    setNeedsBiometricUnlock(false);
  }, []);

  const register = useCallback(async (email, username, password) => {
    const data = await apiRegister(email, username, password);
    await SecureStore.setItemAsync('auth_token', data.token);
    await SecureStore.setItemAsync('auth_credentials', JSON.stringify({ identifier: email, password }));
    setToken(data.token);
    setUser(data.user);
    setNeedsBiometricUnlock(false);
    return data;
  }, []);

  const login = useCallback(async (identifier, password) => {
    const data = await apiLogin(identifier, password);
    await SecureStore.setItemAsync('auth_token', data.token);
    await SecureStore.setItemAsync('auth_credentials', JSON.stringify({ identifier, password }));
    setToken(data.token);
    setUser(data.user);
    setNeedsBiometricUnlock(false);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.log('[Auth] Logout API error (clearing locally):', err.message);
    }
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_credentials');
    setToken(null);
    setUser(null);
    setNeedsBiometricUnlock(false);
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    needsBiometricUnlock,
    biometricUnlock,
    switchToPasswordLogin,
    register,
    login,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
