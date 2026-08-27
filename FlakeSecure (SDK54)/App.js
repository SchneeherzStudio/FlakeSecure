/**
 * ============================================================================
 * FlakeSecure Mobile App - Main Application Entry Point
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ARCHITECTURE:
 * 
 * 1. DEEP LINKING & NAVIGATION:
 *    - Configures URL schemes ('flakesecure://', Universal Links) for rapid pairing and QR code deep-linking.
 *    - Manages React Navigation Native Stack transitions and routing.
 * 
 * 2. LIFECYCLE & AUTH ROUTING (AppContent):
 *    - Restores persisted language preferences (app_language) and onboarding states on app startup.
 *    - Seamlessly routes between OnboardingScreen, BiometricUnlockScreen, LoginScreen, and the Main App Stack based on auth context.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

import { AuthProvider, useAuth } from './app/src/context/AuthContext';
import { LanguageProvider } from './app/src/context/LanguageContext';
import { i18n } from './app/src/i18n';

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
    },
  },
};

const Stack = createNativeStackNavigator();

function AppContent() {
  const { isAuthenticated, isLoading: authLoading, needsBiometricUnlock, biometricUnlock, switchToPasswordLogin } = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const value = await AsyncStorage.getItem('hasCompletedOnboarding');
        setHasOnboarded(value === 'true');

        const savedLang = await AsyncStorage.getItem('app_language');
        if (savedLang && ['en', 'de', 'fr', 'es'].includes(savedLang)) {
          i18n.locale = savedLang;
        }
      } catch (err) {
        console.log('[App] Init error:', err.message);
        setHasOnboarded(false);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

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
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#090b14' },
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Scan" component={ScanScreen} />
      <Stack.Screen name="Confirm" component={ConfirmScreen} />
      <Stack.Screen name="RegisterFill" component={RegisterFillScreen} />
      <Stack.Screen name="Credentials" component={CredentialsScreen} />
      <Stack.Screen name="ViewCredential" component={ViewCredentialScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Logs" component={LogsScreen} />
      <Stack.Screen name="ShareImport" component={ShareImportScreen} />
    </Stack.Navigator>
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
