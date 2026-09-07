/**
 * ============================================================================
 * FlakeSecure Mobile App - Biometric Unlock Screen (BiometricUnlockScreen)
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { AppIcon } from '../components/CategoryIcons';

export function BiometricUnlockScreen({ onUnlock, onUsePassword }) {
  const { biometricUnlock, switchToPasswordLogin } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.logoBadge, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
            <AppIcon name="snowflake" size={36} color={colors.gold} />
          </View>
          <Text style={[styles.logoText, { color: colors.textMain }]}>
            Flake<Text style={{ color: colors.gold }}>Secure</Text>
          </Text>
          <Text style={[styles.title, { color: colors.textMain }]}>{t('biometricUnlock.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSub }]}>{t('biometricUnlock.subtitle')}</Text>
        </View>

        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}>
            <AppIcon name="alert" size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
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
              colors={colors.goldGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.unlockGradient}
            >
              {isAuthenticating ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <AppIcon name="scan" size={20} color="#ffffff" />
                  <Text style={styles.unlockButtonText}>
                    {t('biometricUnlock.unlockBtn')}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.usePasswordButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={handleUsePassword}
            activeOpacity={0.7}
          >
            <Text style={[styles.usePasswordText, { color: colors.textSub }]}>
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
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    width: '100%',
    gap: 14,
  },
  unlockButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  unlockGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 8,
  },
  unlockButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  usePasswordButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  usePasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default BiometricUnlockScreen;
