/**
 * ============================================================================
 * FlakeSecure Mobile App - Biometric Unlock Screen (BiometricUnlockScreen)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. BIOMETRIC UNLOCK & AUTH SESSION REFRESH:
 *    - handleUnlock(): Executes biometric authentication and automatically refreshes session token using stored credentials from SecureStore.
 *    - Auto-unlock prompt on screen mount (useEffect).
 * 
 * 2. MANUAL FALLBACK:
 *    - handleUsePassword(): Allows switching to manual password authentication (LoginScreen) in case of biometric hardware issues or changed credentials.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export function BiometricUnlockScreen({ onUnlock, onUsePassword }) {
  const { biometricUnlock, switchToPasswordLogin } = useAuth();
  const { t } = useLanguage();
  const [error, setError] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleUnlock = async () => {
    setError(null);
    setIsAuthenticating(true);
    try {
      const unlockFn = onUnlock || biometricUnlock;
      const res = await unlockFn();
      if (res && res.success) {
        return;
      }
      
      if (res && res.reason === 'invalid_credentials') {
        setError(t('biometricUnlock.accountNotFound'));
      } else if (res && res.reason === 'no_hardware') {
        const usePassFn = onUsePassword || switchToPasswordLogin;
        await usePassFn();
      } else {
        setError(t('biometricUnlock.failed'));
      }
    } catch (e) {
      setError(t('biometricUnlock.failed'));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleUsePassword = async () => {
    try {
      const usePassFn = onUsePassword || switchToPasswordLogin;
      await usePassFn();
    } catch (e) {
      console.log('Failed to switch to password login', e);
    }
  };

  useEffect(() => {
    handleUnlock();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoEmoji}>❄️</Text>
          </View>
          <Text style={styles.logoText}>
            Flake<Text style={styles.logoAccent}>Secure</Text>
          </Text>
          <Text style={styles.title}>{t('biometricUnlock.title')}</Text>
          <Text style={styles.subtitle}>{t('biometricUnlock.subtitle')}</Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.unlockButton}
            onPress={handleUnlock}
            disabled={isAuthenticating}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#6391ff', '#7c6aff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.unlockGradient}
            >
              {isAuthenticating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.unlockIcon}>👆</Text>
                  <Text style={styles.unlockButtonText}>
                    {t('biometricUnlock.unlockBtn')}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.usePasswordButton}
            onPress={handleUsePassword}
            activeOpacity={0.7}
          >
            <Text style={styles.usePasswordText}>
              {t('biometricUnlock.usePassword')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090b14',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 145, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 145, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 36,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  logoAccent: {
    color: '#6391ff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    width: '100%',
  },
  errorIcon: {
    fontSize: 18,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#fca5a5',
    lineHeight: 18,
  },
  actions: {
    width: '100%',
    gap: 14,
  },
  unlockButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6391ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  unlockGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  unlockIcon: {
    fontSize: 20,
  },
  unlockButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  usePasswordButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  usePasswordText: {
    color: '#6391ff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default BiometricUnlockScreen;
