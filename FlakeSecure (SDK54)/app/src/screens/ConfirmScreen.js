/**
 * ============================================================================
 * FlakeSecure Mobile App - Login Confirmation Screen (ConfirmScreen)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. INITIALIZATION & CREDENTIAL LOOKUP:
 *    - init(): Identifies supported biometric methods (Face ID / Touch ID / Biometrics) and queries stored credentials matching the target domain.
 * 
 * 2. BIOMETRIC CONFIRMATION & RELAY (handleConfirm / sendCredentials):
 *    - Executes biometric authentication via LocalAuthentication.
 *    - Encrypts username and password with the one-time QR key using AES-256-CTR + HMAC-SHA256.
 *    - Relays the ciphertext to POST /send-login for browser autofill.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../context/LanguageContext';
import { findCredentialsForDomain, getTotpItems } from '../utils/storage';
import { encryptCredentials } from '../utils/crypto';

const SERVER_URL = 'https://flakesecure.snowystudio.dev';

export default function ConfirmScreen({ route, navigation }) {
  const { t } = useLanguage();
  const sid = route.params?.sid || route.params?.s;
  const key = route.params?.key || route.params?.k;
  const domain = route.params?.domain || route.params?.d;
  const [state, setState] = useState('loading');
  const [credentials, setCredentials] = useState(null);
  const [matchingTotpItem, setMatchingTotpItem] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [biometricType, setBiometricType] = useState('Biometrie');
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    init();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  async function init() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (Platform.OS === 'ios') {
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Touch ID');
      }
    } else {
      setBiometricType('Biometrie');
    }

    const found = await findCredentialsForDomain(domain);
    if (!found) {
      setState('no-credentials');
      return;
    }

    setCredentials(found);
    setState('ready');
  }

  async function handleConfirm() {
    setState('biometrics');

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `${t('confirm.confirmLogin')} ${domain}`,
        fallbackLabel: 'PIN',
        disableDeviceFallback: false
      });

      if (!result.success) {
        setState('ready');
        return;
      }

      setState('sending');
      await sendCredentials();

    } catch (err) {
      setErrorMsg(t('confirm.biometricFailed', { message: err.message }));
      setState('error');
    }
  }

  async function sendCredentials() {
    try {
      const encrypted = await encryptCredentials({
        username: credentials.username,
        password: credentials.password
      }, key);

      const response = await fetch(`${SERVER_URL}/send-login`, {
        method: 'POST',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': 'https://flakesecure.snowystudio.dev'
        },
        body: JSON.stringify({ sid, payload: encrypted })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server error');
      }

      const totpItems = await getTotpItems();
      const matchingTotp = totpItems.find(
        (tItem) => (tItem.issuer || '').toLowerCase().includes(domain.toLowerCase()) ||
               (domain.toLowerCase().includes((tItem.issuer || '').toLowerCase()))
      );

      setState('success');

      if (matchingTotp) {
        setMatchingTotpItem(matchingTotp);
      } else {
        setTimeout(() => navigation.navigate('Home'), 2500);
      }
    } catch (err) {
      console.error("Detaillierter Netzwerkfehler:", err);
      setErrorMsg(t('confirm.networkError', { message: err.message }));
      setState('error');
    }
  }

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#6391ff" />
            <Text style={styles.loadingText}>{t('confirm.searchingCredentials')}</Text>
          </View>
        );

      case 'no-credentials':
        return (
          <View style={styles.centerContent}>
            <Text style={styles.stateIcon}>🔍</Text>
            <Text style={styles.stateTitle}>{t('confirm.noCredentials')}</Text>
            <Text style={styles.stateText}>
              {t('confirm.noCredentialsFor', { domain })}
            </Text>
            <TouchableOpacity
              style={styles.addCredBtn}
              onPress={() => navigation.navigate('Credentials', { prefillDomain: domain })}
            >
              <Text style={styles.addCredBtnText}>{t('confirm.addCredentials')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelLinkText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        );

      case 'ready':
        return (
          <View style={styles.centerContent}>
            <View style={styles.domainCard}>
              <Text style={styles.domainCardTitle}>{t('confirm.confirmLogin')}</Text>
              <Text style={styles.domainCardDomain}>🌐 {domain}</Text>
              {credentials && (
                <View style={styles.credPreview}>
                  <Text style={styles.credLabel}>{t('confirm.user')}</Text>
                  <Text style={styles.credValue}>{credentials.username}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#6391ff', '#7c6aff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmGradient}
              >
                <Text style={styles.confirmButtonText}>
                  {t('confirm.confirmWith', { biometricType })}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelLinkText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        );

      case 'biometrics':
        return (
          <View style={styles.centerContent}>
            <Animated.Text
              style={[styles.bigIcon, { transform: [{ scale: pulseAnim }] }]}
            >
              {biometricType === 'Face ID' ? '👤' : '👆'}
            </Animated.Text>
            <Text style={styles.stateTitle}>{biometricType}</Text>
            <Text style={styles.stateText}>{t('confirm.authenticating')}</Text>
          </View>
        );

      case 'sending':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#6391ff" />
            <Text style={styles.stateTitle}>{t('confirm.sendingEncrypted')}</Text>
            <Text style={styles.stateText}>{t('confirm.encryptionNote')}</Text>
          </View>
        );

      case 'success':
        return (
          <View style={styles.centerContent}>
            <Text style={styles.bigIcon}>✅</Text>
            <Text style={styles.stateTitle}>{t('confirm.success')}</Text>
            <Text style={styles.stateText}>
              {t('confirm.successText')}
            </Text>

            {matchingTotpItem && (
              <TouchableOpacity
                style={{ marginTop: 20, width: '100%' }}
                onPress={() =>
                  navigation.navigate('Authenticator', {
                    relaySession: { sid, keyHex: key, domain },
                  })
                }
              >
                <LinearGradient
                  colors={['#6391ff', '#7c6aff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtn}
                >
                  <Text style={styles.confirmButtonText}>
                    {t('confirm.streamTotp', { issuer: matchingTotpItem.issuer })}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'error':
        return (
          <View style={styles.centerContent}>
            <Text style={styles.bigIcon}>⚠️</Text>
            <Text style={styles.stateTitle}>{t('error')}</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => setState('ready')}>
              <Text style={styles.retryBtnText}>{t('retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.cancelLinkText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logoText}>❄️ FlakeSecure</Text>
      </View>
      <View style={styles.content}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090b14' },
  header: { alignItems: 'center', paddingVertical: 20 },
  logoText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  content: { flex: 1, paddingHorizontal: 24 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 16, color: 'rgba(255,255,255,0.5)', marginTop: 12 },
  stateIcon: { fontSize: 56, marginBottom: 8 },
  bigIcon: { fontSize: 72, marginBottom: 8 },
  stateTitle: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center' },
  stateText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22 },
  errorText: { fontSize: 14, color: '#fca5a5', textAlign: 'center', paddingHorizontal: 20 },
  domainHighlight: { color: '#6391ff', fontWeight: '600' },
  domainCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, padding: 24, alignItems: 'center', gap: 10
  },
  domainCardTitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.08 },
  domainCardDomain: { fontSize: 20, fontWeight: '700', color: '#fff' },
  credPreview: {
    backgroundColor: 'rgba(99,145,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.2)',
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
    alignItems: 'center', width: '100%'
  },
  credLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 2 },
  credValue: { fontSize: 15, color: '#8eb0ff', fontWeight: '500' },
  confirmButton: { width: '100%', borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  confirmGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18
  },
  biometricIcon: { fontSize: 22 },
  confirmBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  addCredBtn: {
    backgroundColor: 'rgba(99,145,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.3)',
    borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14
  },
  addCredBtnText: { color: '#6391ff', fontWeight: '600', fontSize: 15 },
  cancelLink: { marginTop: 8 },
  cancelLinkText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },
  retryBtn: {
    backgroundColor: 'rgba(99,145,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.3)',
    borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12
  },
  retryBtnText: { color: '#6391ff', fontWeight: '600', fontSize: 14 }
});
