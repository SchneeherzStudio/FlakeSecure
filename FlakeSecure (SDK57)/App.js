/**
 * ============================================================================
 * FlakeSecure Mobile App - Main Application Entry Point v2.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ARCHITECTURE:
 * 
 * 1. DEEP LINKING & NAVIGATION:
 *    - Configures URL schemes ('flakesecure://', Universal Links) for rapid pairing, QR code deep-linking, and TOTP authenticator.
 *    - Manages React Navigation Native Stack transitions across Home, Scan, Confirm, Authenticator, Settings, Logs, Share, and RegisterFill.
 * 
 * 2. SYSTEM STATUS & BLOCKING SCREENS:
 *    - Queries /api/system/status on launch to evaluate maintenance mode and version mismatch.
 *    - Renders MaintenanceScreen when maintenance is active or when app version is outdated.
 * 
 * 3. ANNOUNCEMENTS & POPUPS:
 *    - Checks /api/system/announcements and displays popup dialogs or top banners with dismiss tracking.
 * 
 * 4. LIFECYCLE & AUTH ROUTING (AppContent):
 *    - Restores persisted language preferences (app_language), onboarding states, and routes to Onboarding, BiometricUnlock, Login, or Main Stack.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Modal, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';

import { AuthProvider, useAuth } from './app/src/context/AuthContext';
import { LanguageProvider } from './app/src/context/LanguageContext';
import { i18n } from './app/src/i18n';
import { getSystemStatus, getAnnouncements, dismissAnnouncement } from './app/src/utils/api';

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

const APP_VERSION = '2.0.0';

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
  const p1 = String(v1).replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = String(v2).replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
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
  const { isAuthenticated, isLoading: authLoading, needsBiometricUnlock, biometricUnlock, switchToPasswordLogin } = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const [systemState, setSystemState] = useState({
    checked: false,
    isMaintenance: false,
    maintenanceMessage: '',
    maintenanceUntil: null,
    isOutdated: false,
    minVersion: '2.0.0',
    isOffline: false,
  });

  const [activePopupAnnouncement, setActivePopupAnnouncement] = useState(null);
  const [bannerAnnouncements, setBannerAnnouncements] = useState([]);

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

  const loadAnnouncements = async () => {
    try {
      const res = await getAnnouncements();
      const list = res?.announcements || [];

      const banners = list.filter((a) => a.type === 'banner');
      setBannerAnnouncements(banners);

      const popups = list.filter((a) => a.type === 'popup');
      if (popups.length > 0) {
        const topPopup = popups[0];
        const dismissedLocal = await AsyncStorage.getItem(`dismissed_popup_${topPopup.id}`);
        if (!dismissedLocal || topPopup.display === 'always') {
          setActivePopupAnnouncement(topPopup);
        }
      }
    } catch (e) {
      console.log('[App] Announcements load error:', e.message);
    }
  };

  const handleDismissPopup = async () => {
    if (!activePopupAnnouncement) return;
    const popup = activePopupAnnouncement;
    setActivePopupAnnouncement(null);

    if (popup.display === 'once') {
      await AsyncStorage.setItem(`dismissed_popup_${popup.id}`, 'true').catch(() => {});
      if (isAuthenticated) {
        dismissAnnouncement(popup.id).catch(() => {});
      }
    }
  };

  useEffect(() => {
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
      <View style={{ flex: 1, backgroundColor: '#090b14', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#6391ff" />
      </View>
    );
  }

  if (systemState.isMaintenance) {
    return (
      <MaintenanceScreen
        reason="maintenance"
        message={systemState.maintenanceMessage}
        until={systemState.maintenanceUntil}
        isOffline={systemState.isOffline}
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
    return <BiometricUnlockScreen onUnlock={biometricUnlock} onUsePassword={switchToPasswordLogin} />;
  }

  if (!isAuthenticated) {
    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#090b14' },
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
          contentStyle: { backgroundColor: '#090b14' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Home">
          {(props) => (
            <HomeScreen
              {...props}
              bannerAnnouncements={bannerAnnouncements}
              isOffline={systemState.isOffline}
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
        <View style={styles.modalOverlay}>
          <View style={styles.popupCard}>
            <View style={styles.popupIconCircle}>
              <Text style={styles.popupIconEmoji}>📢</Text>
            </View>
            <Text style={styles.popupTitle}>Information</Text>
            <Text style={styles.popupMessage}>{activePopupAnnouncement?.message}</Text>

            <TouchableOpacity style={styles.popupBtn} onPress={handleDismissPopup}>
              <LinearGradient
                colors={['#6391ff', '#7c6aff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.popupGradientBtn}
              >
                <Text style={styles.popupBtnText}>Verstanden</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <NavigationContainer linking={linking}>
            <StatusBar style="light" />
            <AppContent />
          </NavigationContainer>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 11, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popupCard: {
    backgroundColor: '#0f1220',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  popupIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 145, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  popupIconEmoji: {
    fontSize: 32,
  },
  popupTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  popupMessage: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  popupBtn: {
    width: '100%',
  },
  popupGradientBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
