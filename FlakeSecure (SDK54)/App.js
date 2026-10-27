/**
 * ============================================================================
 * FlakeSecure Mobile App - Main Application Entry Point v2.1.0
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  View,
  Modal,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemeProvider, useTheme } from './app/src/context/ThemeContext';
import { AuthProvider, useAuth } from './app/src/context/AuthContext';
import { LanguageProvider, useLanguage } from './app/src/context/LanguageContext';
import { ToastProvider, toast } from './app/src/components/Toast';
import { i18n } from './app/src/i18n';
import {
  getSystemStatus,
  getAnnouncements,
  dismissAnnouncement,
  checkServerReachability,
} from './app/src/utils/api';
import { flushPendingVaultSync } from './app/src/utils/vault';
import {
  configureNotificationsHandler,
  registerDeviceForPushNotifications,
  runLocalSecurityNotificationsCheck,
} from './app/src/utils/notifications';
import {
  syncVaultToNativeAutofill,
  importPendingAutofillSaves,
} from './app/src/utils/autofillBridge';
import { AppIcon } from './app/src/components/CategoryIcons';

import HomeScreen from './app/src/screens/HomeScreen';
import ScanScreen from './app/src/screens/ScanScreen';
import ConfirmScreen from './app/src/screens/ConfirmScreen';
import CredentialsScreen from './app/src/screens/CredentialsScreen';
import ViewCredentialScreen from './app/src/screens/ViewCredentialScreen';
import OnboardingScreen from './app/src/screens/OnboardingScreen';
import LoginScreen from './app/src/screens/LoginScreen';
import { BiometricUnlockScreen } from './app/src/screens/BiometricUnlockScreen';
import SettingsScreen from './app/src/screens/SettingsScreen';
import LogsScreen from './app/src/screens/LogsScreen';
import ShareImportScreen from './app/src/screens/ShareImportScreen';
import RegisterFillScreen from './app/src/screens/RegisterFillScreen';
import MaintenanceScreen from './app/src/screens/MaintenanceScreen';
import AuthenticatorScreen from './app/src/screens/AuthenticatorScreen';
import { VaultTransferScreen } from './app/src/screens/VaultTransferScreen';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const APP_VERSION = '2.1.0';

const prefix = Linking.createURL('/');
const linking = {
  prefixes: [prefix, 'flakesecure://', 'https://flakesecure.snowystudio.dev'],
  config: {
    screens: {
      Home: '',
      Scan: 'scan',
      Confirm: 'auth',
      RegisterFill: 'register',
      ShareImport: 'share',
      Settings: 'settings',
      Logs: 'logs',
      Credentials: 'credentials',
      ViewCredential: 'credential/:domain',
      Authenticator: 'totp',
      VaultTransfer: 'vault-transfer',
    },
  },
};

function compareSemver(v1, v2) {
  if (!v1 || !v2) return 0;
  const p1 = String(v1)
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const p2 = String(v2)
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

const Stack = createNativeStackNavigator();

function AppContent() {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const {
    isAuthenticated,
    isLoading: authLoading,
    needsBiometricUnlock,
    isOfflineMode,
    biometricUnlock,
    switchToPasswordLogin,
  } = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const [systemState, setSystemState] = useState({
    checked: false,
    isMaintenance: false,
    maintenanceMessage: '',
    maintenanceUntil: null,
    isOutdated: false,
    minVersion: APP_VERSION,
    isOffline: false,
  });

  const [activePopupAnnouncement, setActivePopupAnnouncement] = useState(null);
  const [bannerAnnouncements, setBannerAnnouncements] = useState([]);
  const prevOfflineRef = useRef(false);

  const checkSystem = useCallback(async () => {
    try {
      const status = await getSystemStatus();
      const isMaint = !!status?.maintenance?.active;
      const targetVersion = status?.minAppVersion || status?.version || APP_VERSION;
      const isOutdated = compareSemver(APP_VERSION, targetVersion) < 0;

      setSystemState({
        checked: true,
        isMaintenance: isMaint,
        maintenanceMessage: status?.maintenance?.message || '',
        maintenanceUntil: status?.maintenance?.until || null,
        isOutdated: !!isOutdated,
        minVersion: targetVersion,
        isOffline: false,
      });

      if (!isMaint && !isOutdated) {
        loadAnnouncements();
      }
    } catch (err) {
      console.log('[App] System status check error (offline/unreachable):', err.message);
      setSystemState((prev) => ({
        ...prev,
        checked: true,
        isOffline: true,
      }));
    }
  }, []);

  // Reconnect watcher & pending vault sync flush
  useEffect(() => {
    const currentlyOffline = !!(isOfflineMode || systemState.isOffline);
    if (prevOfflineRef.current && !currentlyOffline && isAuthenticated) {
      flushPendingVaultSync()
        .then((flushed) => {
          toast.success(t('offline.backOnlineSyncedToast'));
          if (flushed) {
            syncVaultToNativeAutofill().catch(() => {});
          }
        })
        .catch(() => {});
    }
    prevOfflineRef.current = currentlyOffline;

    if (!currentlyOffline) return;
    const interval = setInterval(() => {
      checkServerReachability().then((online) => {
        if (online) {
          setSystemState((prev) => ({ ...prev, isOffline: false }));
        }
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [isOfflineMode, systemState.isOffline, isAuthenticated, t]);

  // Post-unlock push registration, security checks & native autofill sync
  useEffect(() => {
    if (!isAuthenticated || needsBiometricUnlock) return;

    registerDeviceForPushNotifications(language || i18n.locale || 'de').catch(() => {});
    syncVaultToNativeAutofill().catch(() => {});

    importPendingAutofillSaves()
      .then((count) => {
        if (count > 0) {
          toast.success(t('autofill.importedPendingToast', { count }));
        }
      })
      .catch(() => {});

    const timer = setTimeout(() => {
      runLocalSecurityNotificationsCheck(t).catch(() => {});
    }, 2500);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        importPendingAutofillSaves()
          .then((count) => {
            if (count > 0) {
              toast.success(t('autofill.importedPendingToast', { count }));
            }
          })
          .catch(() => {});
      }
    });

    return () => {
      clearTimeout(timer);
      appStateSub?.remove?.();
    };
  }, [isAuthenticated, needsBiometricUnlock, language, t]);

  const sessionDismissedBannersRef = useRef(new Set());

  const getPriorityTheme = useCallback(
    (priority = 0) => {
      const p = Number(priority) || 0;
      if (p >= 50) {
        return {
          level: 'critical',
          color: colors.red,
          bg: colors.redDim,
          border: colors.redBorder,
          iconBg: colors.redDim,
          gradient: [colors.red, '#b91c1c'],
          iconName: 'alert',
          title: 'Dringende Mitteilung',
        };
      } else if (p >= 10) {
        return {
          level: 'warning',
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.16)',
          border: 'rgba(245, 158, 11, 0.55)',
          iconBg: 'rgba(245, 158, 11, 0.25)',
          gradient: ['#f59e0b', '#d97706'],
          iconName: 'alert',
          title: 'Wichtige Mitteilung',
        };
      } else {
        return {
          level: 'info',
          color: colors.gold,
          bg: colors.goldDim,
          border: colors.goldBorder,
          iconBg: colors.goldDim,
          gradient: colors.goldGradient,
          iconName: 'info',
          title: 'Information',
        };
      }
    },
    [colors]
  );

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await getAnnouncements();
      const list = res?.announcements || [];

      const rawBanners = list.filter((a) => a.type === 'banner');
      const visibleBanners = [];
      for (const b of rawBanners) {
        if (sessionDismissedBannersRef.current.has(b.id)) continue;
        if (b.display === 'once') {
          const dismissed = await AsyncStorage.getItem(`dismissed_announcement_${b.id}`);
          const dismissedLegacy = await AsyncStorage.getItem(`dismissed_banner_${b.id}`);
          if (dismissed || dismissedLegacy) continue;
        }
        visibleBanners.push(b);
      }
      setBannerAnnouncements(visibleBanners);

      const rawPopups = list.filter((a) => a.type === 'popup');
      let candidatePopup = null;
      for (const p of rawPopups) {
        if (sessionDismissedBannersRef.current.has(p.id)) continue;
        if (p.display === 'once') {
          const dismissed = await AsyncStorage.getItem(`dismissed_announcement_${p.id}`);
          const dismissedLegacy = await AsyncStorage.getItem(`dismissed_popup_${p.id}`);
          if (dismissed || dismissedLegacy) continue;
        }
        candidatePopup = p;
        break;
      }
      setActivePopupAnnouncement(candidatePopup);
    } catch (e) {
      console.log('[App] Announcements load error:', e.message);
    }
  }, []);

  const handleDismissBanner = useCallback(
    async (id, display) => {
      sessionDismissedBannersRef.current.add(id);
      setBannerAnnouncements((prev) => prev.filter((b) => b.id !== id));

      if (display === 'once') {
        await AsyncStorage.setItem(`dismissed_announcement_${id}`, 'true').catch(() => {});
        await AsyncStorage.setItem(`dismissed_banner_${id}`, 'true').catch(() => {});
        if (isAuthenticated) {
          dismissAnnouncement(id).catch(() => {});
        }
      }
    },
    [isAuthenticated]
  );

  const handleDismissPopup = useCallback(async () => {
    if (!activePopupAnnouncement) return;
    const popup = activePopupAnnouncement;
    sessionDismissedBannersRef.current.add(popup.id);
    setActivePopupAnnouncement(null);

    if (popup.display === 'once') {
      await AsyncStorage.setItem(`dismissed_announcement_${popup.id}`, 'true').catch(
        () => {}
      );
      await AsyncStorage.setItem(`dismissed_popup_${popup.id}`, 'true').catch(() => {});
      if (isAuthenticated) {
        dismissAnnouncement(popup.id).catch(() => {});
      }
    }
  }, [activePopupAnnouncement, isAuthenticated]);

  useEffect(() => {
    configureNotificationsHandler();
    (async () => {
      try {
        const value = await AsyncStorage.getItem('hasCompletedOnboarding');
        setHasOnboarded(value === 'true');

        const savedLang = await AsyncStorage.getItem('app_language');
        if (savedLang && ['en', 'de', 'fr', 'es'].includes(savedLang)) {
          i18n.locale = savedLang;
        }

        await checkSystem();
      } catch (err) {
        console.log('[App] Init error:', err.message);
        setHasOnboarded(false);
      } finally {
        setIsReady(true);
      }
    })();
  }, [checkSystem]);

  const handleOnboardingComplete = useCallback(() => {
    setHasOnboarded(true);
  }, []);

  if (!isReady || authLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (systemState.isMaintenance) {
    return (
      <MaintenanceScreen
        reason="maintenance"
        message={systemState.maintenanceMessage}
        until={systemState.maintenanceUntil}
        isOffline={systemState.isOffline || isOfflineMode}
        onRetry={checkSystem}
      />
    );
  }

  if (systemState.isOutdated) {
    return (
      <MaintenanceScreen
        reason="outdated"
        minVersion={systemState.minVersion}
        currentVersion={APP_VERSION}
        onRetry={checkSystem}
      />
    );
  }

  if (!hasOnboarded) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (needsBiometricUnlock) {
    return (
      <BiometricUnlockScreen
        onUnlock={biometricUnlock}
        onUsePassword={switchToPasswordLogin}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Home">
          {(props) => (
            <HomeScreen
              {...props}
              bannerAnnouncements={bannerAnnouncements}
              onDismissBanner={handleDismissBanner}
              isOffline={systemState.isOffline || isOfflineMode}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="Confirm" component={ConfirmScreen} />
        <Stack.Screen name="RegisterFill" component={RegisterFillScreen} />
        <Stack.Screen name="Authenticator" component={AuthenticatorScreen} />
        <Stack.Screen name="Credentials" component={CredentialsScreen} />
        <Stack.Screen name="ViewCredential" component={ViewCredentialScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Logs" component={LogsScreen} />
        <Stack.Screen name="ShareImport" component={ShareImportScreen} />
        <Stack.Screen name="VaultTransfer" component={VaultTransferScreen} />
      </Stack.Navigator>

      <Modal visible={!!activePopupAnnouncement} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          {(() => {
            const theme = getPriorityTheme(activePopupAnnouncement?.priority);
            return (
              <View
                style={[
                  styles.popupCard,
                  { backgroundColor: colors.modalCard, borderColor: theme.border },
                ]}
              >
                <View style={[styles.popupIconCircle, { backgroundColor: theme.iconBg }]}>
                  <AppIcon name={theme.iconName} size={28} color={theme.color} />
                </View>
                <Text style={[styles.popupTitle, { color: theme.color }]}>
                  {theme.title}
                </Text>
                <Text style={[styles.popupMessage, { color: colors.textSecondary }]}>
                  {activePopupAnnouncement?.message}
                </Text>

                <TouchableOpacity
                  style={styles.popupBtn}
                  onPress={handleDismissPopup}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={theme.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.popupGradientBtn}
                  >
                    <Text
                      style={[
                        styles.popupBtnText,
                        { color: colors.isDark ? '#07090e' : '#fff' },
                      ]}
                    >
                      Verstanden
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </Modal>
    </>
  );
}

function NavigationRoot() {
  const { colors } = useTheme();
  const { isAuthenticated, needsBiometricUnlock } = useAuth();
  const navigationRef = useNavigationContainerRef();
  const [pendingOtpUri, setPendingOtpUri] = useState(null);
  const [pendingNotifTarget, setPendingNotifTarget] = useState(null);
  const [navReady, setNavReady] = useState(false);

  useEffect(() => {
    const handleUrl = (url) => {
      if (
        url &&
        typeof url === 'string' &&
        (url.toLowerCase().startsWith('otpauth://') ||
          url.toLowerCase().startsWith('otpauth-migration://'))
      ) {
        setPendingOtpUri(url);
      }
    };

    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) handleUrl(initialUrl);
      })
      .catch(() => {});

    const sub = Linking.addEventListener('url', (event) => {
      if (event?.url) handleUrl(event.url);
    });

    return () => {
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, []);

  // Notification tap deep-linking
  useEffect(() => {
    if (!Notifications) return;

    const extractTarget = (response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.targetScreen) {
        setPendingNotifTarget({
          targetScreen: String(data.targetScreen),
          cardId: data.cardId || null,
          codeId: data.codeId || null,
        });
      }
    };

    if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
      Notifications.getLastNotificationResponseAsync()
        .then((lastResp) => {
          if (lastResp) extractTarget(lastResp);
        })
        .catch(() => {});
    }

    let responseSub = null;
    if (typeof Notifications.addNotificationResponseReceivedListener === 'function') {
      responseSub = Notifications.addNotificationResponseReceivedListener(extractTarget);
    }

    return () => {
      responseSub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (
      pendingOtpUri &&
      navReady &&
      isAuthenticated &&
      !needsBiometricUnlock &&
      navigationRef.isReady()
    ) {
      const uriToOpen = pendingOtpUri;
      setPendingOtpUri(null);
      navigationRef.navigate('Authenticator', { otpauthUri: uriToOpen });
    }
  }, [pendingOtpUri, navReady, isAuthenticated, needsBiometricUnlock, navigationRef]);

  useEffect(() => {
    if (
      pendingNotifTarget &&
      navReady &&
      isAuthenticated &&
      !needsBiometricUnlock &&
      navigationRef.isReady()
    ) {
      const { targetScreen, cardId, codeId } = pendingNotifTarget;
      setPendingNotifTarget(null);

      if (targetScreen === 'Home:cards') {
        if (cardId) {
          navigationRef.navigate('ViewCredential', { itemType: 'card', cardId });
        } else {
          navigationRef.navigate('Home', { initialSegment: 'cards' });
        }
      } else if (targetScreen === 'Home:codes') {
        if (codeId) {
          navigationRef.navigate('ViewCredential', { itemType: 'code', codeId });
        } else {
          navigationRef.navigate('Home', { initialSegment: 'codes' });
        }
      } else if (targetScreen === 'Home') {
        navigationRef.navigate('Home', { initialSegment: 'logins' });
      } else if (
        [
          'Authenticator',
          'Settings',
          'Logs',
          'Scan',
          'ShareImport',
          'VaultTransfer',
        ].includes(targetScreen)
      ) {
        navigationRef.navigate(targetScreen);
      }
    }
  }, [
    pendingNotifTarget,
    navReady,
    isAuthenticated,
    needsBiometricUnlock,
    navigationRef,
  ]);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => setNavReady(true)}
    >
      <StatusBar style={colors.statusBar} />
      <AppContent />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <NavigationRoot />
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popupCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  popupIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  popupMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  popupBtn: {
    width: '100%',
  },
  popupGradientBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
