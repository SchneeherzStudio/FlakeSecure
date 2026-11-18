/**
 * ============================================================================
 * FlakeSecure Mobile App - Maintenance & Outdated Blocking Screen
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { AppIcon } from '../components/CategoryIcons';

export default function MaintenanceScreen({
  reason = 'maintenance',
  message = '',
  until = null,
  minVersion = '',
  currentVersion = '',
  isOffline = false,
  onRetry,
}) {
  const { t, locale } = useLanguage();
  const { colors } = useTheme();
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (onRetry) onRetry();
    }, 30000);
    return () => clearInterval(timer);
  }, [onRetry]);

  const handleManualCheck = async () => {
    if (!onRetry) return;
    setChecking(true);
    try {
      await onRetry();
    } finally {
      setChecking(false);
    }
  };

  const handleRefresh = async () => {
    if (!onRetry) return;
    setRefreshing(true);
    try {
      await onRetry();
    } finally {
      setRefreshing(false);
    }
  };

  const formattedUntil = until
    ? new Date(until).toLocaleString(locale || 'en', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />
        }
      >
        {isOffline && (
          <View style={[styles.offlineBanner, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
            <AppIcon name="wifiOff" size={18} color={colors.gold} style={{ marginRight: 8 }} />
            <Text style={[styles.offlineText, { color: colors.gold }]}>
              {t('maintenance.offlineBanner')}
            </Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
            <AppIcon
              name={isOffline ? 'wifiOff' : reason === 'outdated' ? 'alert' : 'gear'}
              size={36}
              color={colors.gold}
            />
          </View>

          <Text style={[styles.title, { color: colors.textMain }]}>
            {reason === 'outdated'
              ? t('maintenance.outdatedTitle')
              : isOffline
              ? t('maintenance.offlineTitle')
              : t('maintenance.maintenanceTitle')}
          </Text>

          <Text style={[styles.subtitle, { color: colors.textSub }]}>
            {reason === 'outdated'
              ? t('maintenance.outdatedMsg', { current: currentVersion, min: minVersion })
              : message || t('maintenance.defaultMaintMsg')}
          </Text>

          {formattedUntil && reason === 'maintenance' && (
            <View style={[styles.timeBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[styles.timeLabel, { color: colors.textMuted }]}>{t('maintenance.availableUntil')}</Text>
              <Text style={[styles.timeValue, { color: colors.gold }]}>{formattedUntil}</Text>
            </View>
          )}

          {reason === 'outdated' ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/#downloads')}
            >
              <LinearGradient
                colors={colors.goldGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                <Text style={styles.btnText}>{t('maintenance.updateNow')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleManualCheck}
              disabled={checking}
            >
              <LinearGradient
                colors={colors.goldGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                {checking ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.btnText}>{t('maintenance.checkAgain')}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          <Text style={[styles.footerNote, { color: colors.textMuted }]}>
            {reason === 'outdated'
              ? t('maintenance.outdatedNote')
              : t('maintenance.localVaultSafeNote')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  timeBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  timeLabel: {
    fontSize: 11,
    marginBottom: 2,
    fontWeight: '600',
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionBtn: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradientBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  footerNote: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
