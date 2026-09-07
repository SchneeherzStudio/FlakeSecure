/**
 * ============================================================================
 * FlakeSecure Mobile App - Login Confirmation Screen (ConfirmScreen)
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
import { useTheme } from '../context/ThemeContext';
import { AppIcon } from '../components/CategoryIcons';
import FaviconImage from '../components/FaviconImage';
import { findCredentialsForDomain, getTotpItems } from '../utils/storage';
import { encryptCredentials } from '../utils/crypto';
import { sendLogin } from '../utils/api';
import { CredentialCardSkeleton } from '../components/Skeleton';
import { TapFeedback } from '../components/TapFeedback';

export default function ConfirmScreen({ route, navigation }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
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

      const data = await sendLogin(sid, encrypted);

      if (data && data.error) {
        throw new Error(data.error);
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
          <View style={[styles.centerContent, { width: '100%', paddingHorizontal: 20 }]}>
            <CredentialCardSkeleton />
            <Text style={[styles.loadingText, { color: colors.textMuted, marginTop: 12 }]}>{t('confirm.searchingCredentials')}</Text>
          </View>
        );

      case 'no-credentials':
        return (
          <View style={styles.centerContent}>
            <AppIcon name="alert" size={48} color={colors.gold} style={{ marginBottom: 8 }} />
            <Text style={[styles.stateTitle, { color: colors.textMain }]}>{t('confirm.noCredentials')}</Text>
            <Text style={[styles.stateText, { color: colors.textSub }]}>
              {t('confirm.noCredentialsFor', { domain })}
            </Text>
            <TapFeedback
              style={[styles.addCredBtn, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
              onPress={() => navigation.navigate('Credentials', { prefillDomain: domain })}
            >
              <Text style={[styles.addCredBtnText, { color: colors.gold }]}>{t('confirm.addCredentials')}</Text>
            </TapFeedback>
            <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
              <Text style={[styles.cancelLinkText, { color: colors.textMuted }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        );

      case 'ready':
        return (
          <View style={styles.centerContent}>
            <View style={[styles.domainCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Text style={[styles.domainCardTitle, { color: colors.textMuted }]}>{t('confirm.confirmLogin')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginVertical: 8 }}>
                <FaviconImage domain={domain} size={28} borderRadius={6} />
                <Text style={[styles.domainCardDomain, { color: colors.textMain }]}>{domain}</Text>
              </View>
              {credentials && (
                <View style={[styles.credPreview, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
                  <Text style={[styles.credLabel, { color: colors.textMuted }]}>{t('confirm.user')}</Text>
                  <Text style={[styles.credValue, { color: colors.gold }]}>{credentials.username}</Text>
                </View>
              )}
            </View>

            <TapFeedback
              style={styles.confirmButton}
              onPress={handleConfirm}
            >
              <LinearGradient
                colors={colors.goldGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmGradient}
              >
                <AppIcon name="scan" size={20} color="#ffffff" />
                <Text style={styles.confirmButtonText}>
                  {t('confirm.confirmWith', { biometricType })}
                </Text>
              </LinearGradient>
            </TapFeedback>

            <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
              <Text style={[styles.cancelLinkText, { color: colors.textMuted }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        );

      case 'biometrics':
        return (
          <View style={styles.centerContent}>
            <Animated.View
              style={{ transform: [{ scale: pulseAnim }], marginBottom: 16 }}
            >
              <AppIcon name="scan" size={56} color={colors.gold} />
            </Animated.View>
            <Text style={[styles.stateTitle, { color: colors.textMain }]}>{biometricType}</Text>
            <Text style={[styles.stateText, { color: colors.textSub }]}>{t('confirm.authenticating')}</Text>
          </View>
        );

      case 'sending':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={[styles.stateTitle, { color: colors.textMain, marginTop: 12 }]}>{t('confirm.sendingEncrypted')}</Text>
            <Text style={[styles.stateText, { color: colors.textSub }]}>{t('confirm.encryptionNote')}</Text>
          </View>
        );

      case 'success':
        return (
          <View style={styles.centerContent}>
            <View style={[styles.successIconBox, { backgroundColor: colors.successBg, borderColor: colors.successBorder }]}>
              <AppIcon name="check" size={42} color={colors.success} />
            </View>
            <Text style={[styles.stateTitle, { color: colors.textMain }]}>{t('confirm.success')}</Text>
            <Text style={[styles.stateText, { color: colors.textSub }]}>
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
                  colors={colors.goldGradient}
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
            <AppIcon name="alert" size={48} color={colors.danger} style={{ marginBottom: 8 }} />
            <Text style={[styles.stateTitle, { color: colors.textMain }]}>{t('error')}</Text>
            <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
              onPress={() => setState('ready')}
            >
              <Text style={[styles.retryBtnText, { color: colors.gold }]}>{t('retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.navigate('Home')}>
              <Text style={[styles.cancelLinkText, { color: colors.textMuted }]}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <AppIcon name="snowflake" size={20} color={colors.gold} style={{ marginRight: 6 }} />
          <Text style={[styles.logoText, { color: colors.textMain }]}>FlakeSecure</Text>
        </View>
      </View>
      <View style={styles.content}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingVertical: 18 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoText: { fontSize: 18, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 24 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 15, textAlign: 'center' },
  stateTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  stateText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  domainCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  domainCardTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  domainCardDomain: { fontSize: 20, fontWeight: '700' },
  credPreview: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  credLabel: { fontSize: 11, marginBottom: 2, textTransform: 'uppercase' },
  credValue: { fontSize: 15, fontWeight: '700' },
  confirmButton: { width: '100%', borderRadius: 8, overflow: 'hidden', marginTop: 8 },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  confirmButtonText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  successIconBox: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  addCredBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  addCredBtnText: { fontWeight: '700', fontSize: 14 },
  cancelLink: { marginTop: 8, padding: 8 },
  cancelLinkText: { fontSize: 14, fontWeight: '500' },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryBtnText: { fontWeight: '700', fontSize: 14 },
});
