/**
 * ============================================================================
 * FlakeSecure Mobile App - Maintenance & Outdated Blocking Screen
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. BLOCKING SYSTEM DISPLAY:
 *    - Displays full-screen blocking overlay when maintenance is active or when the app version is outdated.
 *    - Renders offline banner ("Du bist zurzeit offline – Funktionen eingeschränkt") when network is unreachable.
 * 
 * 2. SYSTEM STATUS POLLING & RETRY:
 *    - handleRetry(): Triggers immediate status re-check against /api/system/status.
 *    - Auto-polls every 30 seconds to automatically dismiss screen when server maintenance ends.
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
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6391ff" />
        }
      >
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineIcon}>📡</Text>
            <Text style={styles.offlineText}>
              {t('maintenance.offlineBanner')}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Text style={styles.mainEmoji}>
              {reason === 'outdated' ? '🚀' : isOffline ? '🔌' : '🛠️'}
            </Text>
          </View>

          <Text style={styles.title}>
            {reason === 'outdated'
              ? t('maintenance.outdatedTitle')
              : isOffline
              ? t('maintenance.offlineTitle')
              : t('maintenance.maintenanceTitle')}
          </Text>

          <Text style={styles.subtitle}>
            {reason === 'outdated'
              ? t('maintenance.outdatedMsg', { current: currentVersion, min: minVersion })
              : message || t('maintenance.defaultMaintMsg')}
          </Text>

          {formattedUntil && reason === 'maintenance' && (
            <View style={styles.timeBox}>
              <Text style={styles.timeLabel}>{t('maintenance.availableUntil')}</Text>
              <Text style={styles.timeValue}>{formattedUntil}</Text>
            </View>
          )}

          {reason === 'outdated' ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/#downloads')}
            >
              <LinearGradient
                colors={['#6391ff', '#7c6aff']}
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
                colors={['#6391ff', '#7c6aff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                {checking ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnText}>{t('maintenance.checkAgain')}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          <Text style={styles.footerNote}>
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
    backgroundColor: '#090b14',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderColor: 'rgba(255, 149, 0, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  offlineIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  offlineText: {
    color: '#ffb340',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 145, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  mainEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  timeBox: {
    backgroundColor: 'rgba(99, 145, 255, 0.08)',
    borderColor: 'rgba(99, 145, 255, 0.2)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  timeLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
    fontWeight: '600',
  },
  timeValue: {
    fontSize: 16,
    color: '#6391ff',
    fontWeight: '700',
  },
  actionBtn: {
    width: '100%',
    marginBottom: 20,
  },
  gradientBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.35)',
    textAlign: 'center',
    lineHeight: 18,
  },
});
