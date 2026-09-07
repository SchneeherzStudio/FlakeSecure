/**
 * ============================================================================
 * FlakeSecure Mobile App - Cloud Vault Restore & Cross-Device Key Transfer
 * (VaultTransferScreen) v2.0
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ExpoCrypto from 'expo-crypto';

import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { syncVaultFromServer } from '../utils/vault';
import { decryptCredentials, bytesToHex } from '../utils/crypto';
import { importFullVault } from '../utils/storage';
import { getServerUrl } from '../utils/api';
import { AppIcon } from '../components/CategoryIcons';

export function VaultTransferScreen({ route, navigation }) {
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();
  const { user, login } = useAuth();
  const initialMode = route.params?.mode || 'check_or_receive';

  const [checkingLocal, setCheckingLocal] = useState(true);
  const [hasLocalKey, setHasLocalKey] = useState(false);
  const [localCreds, setLocalCreds] = useState(null);

  const [qrData, setQrData] = useState(null);
  const [activeSid, setActiveSid] = useState(null);
  const [transferKeyHex, setTransferKeyHex] = useState(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState('');

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    checkLocalKey();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkLocalKey = async () => {
    try {
      const raw = await SecureStore.getItemAsync('auth_credentials');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.password) {
          setHasLocalKey(true);
          setLocalCreds(parsed);
          setCheckingLocal(false);
          return;
        }
      }
    } catch (e) {}

    setHasLocalKey(false);
    setCheckingLocal(false);
    startQrReceiveSession();
  };

  const handleLocalRestore = async () => {
    if (!localCreds || !localCreds.password) {
      startQrReceiveSession();
      return;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('vaultTransfer.biometricPrompt') || 'Authenticate to restore cloud vault',
        fallbackLabel: 'PIN',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        Alert.alert(t('error'), t('vaultTransfer.biometricRequired') || 'Biometric authentication required.');
        return;
      }

      setIsTransferring(true);
      setTransferStatus(t('vaultTransfer.restoringVault') || 'Restoring cloud vault…');

      const syncResult = await syncVaultFromServer(localCreds.password);

      if (syncResult && syncResult.success) {
        Alert.alert(
          t('success'),
          t('vaultTransfer.restoreSuccess') || 'Vault restored successfully from cloud!',
          [{ text: t('ok'), onPress: () => navigation.navigate('Home') }]
        );
      } else {
        throw new Error(syncResult?.error || 'Could not decrypt remote cloud vault.');
      }
    } catch (err) {
      Alert.alert(t('error'), err.message || 'Restoration failed.');
    } finally {
      setIsTransferring(false);
    }
  };

  const startQrReceiveSession = async () => {
    try {
      setIsTransferring(true);
      setTransferStatus(t('vaultTransfer.generatingSession') || 'Starting transfer session…');

      const randomKey = await ExpoCrypto.getRandomBytesAsync(32);
      const keyHex = bytesToHex(randomKey);

      const randomSid = await ExpoCrypto.getRandomBytesAsync(16);
      const sid = bytesToHex(randomSid);

      setTransferKeyHex(keyHex);
      setActiveSid(sid);

      const qrPayload = `flakesecure://vault-transfer?sid=${sid}&key=${keyHex}&action=vault_key_transfer`;
      setQrData(qrPayload);
      setIsTransferring(false);

      startPollLoop(sid, keyHex);
    } catch (e) {
      Alert.alert(t('error'), 'Could not start receiver session');
      setIsTransferring(false);
    }
  };

  const startPollLoop = (sid, keyHex) => {
    let attempts = 0;
    const maxAttempts = 120; // 3 minutes at 1.5s interval

    const timer = setInterval(async () => {
      if (!isMountedRef.current) {
        clearInterval(timer);
        return;
      }

      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(timer);
        setQrData(null);
        setActiveSid(null);
        Alert.alert(t('error'), t('vaultTransfer.timeoutMsg') || 'Session expired. Please try again.');
        return;
      }

      try {
        const serverUrl = await getServerUrl();
        const res = await fetch(`${serverUrl}/api/share/consume/${sid}`);
        if (!res.ok) {
          return;
        }

        clearInterval(timer);
        setTransferStatus(t('vaultTransfer.receivingData') || 'Authorizing & restoring vault…');
        setIsTransferring(true);

        const responseJson = await res.json();
        let payloadRaw = responseJson.payload;
        if (typeof payloadRaw === 'string') {
          try {
            payloadRaw = JSON.parse(payloadRaw);
          } catch (e) {}
        }

        const decryptedJson = await decryptCredentials(payloadRaw, keyHex);
        const packet = JSON.parse(decryptedJson);

        if (!packet || !packet.password) {
          throw new Error('Corrupted or invalid vault transfer packet.');
        }

        const restoredCreds = {
          identifier: packet.identifier || user?.email || user?.username,
          email: packet.email || user?.email,
          username: packet.username || user?.username,
          password: packet.password,
        };

        await SecureStore.setItemAsync('auth_credentials', JSON.stringify(restoredCreds));

        if (packet.vaultData) {
          await importFullVault(packet.vaultData);
        }

        try {
          await syncVaultFromServer(packet.password);
        } catch (syncErr) {}

        Alert.alert(
          t('success'),
          t('vaultTransfer.deviceAuthorizedSuccess') || 'Device successfully authorized and cloud vault restored!',
          [{ text: t('ok'), onPress: () => navigation.navigate('Home') }]
        );
      } catch (err) {
        Alert.alert(t('error'), err.message || 'Key reception failed.');
      } finally {
        setIsTransferring(false);
      }
    }, 1500);
  };

  const handleCancel = async () => {
    if (activeSid) {
      try {
        const serverUrl = await getServerUrl();
        await fetch(`${serverUrl}/api/share/cancel/${activeSid}`, { method: 'DELETE' });
      } catch (e) {}
    }
    navigation.goBack();
  };

  if (checkingLocal) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleCancel} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.gold }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textMain }]}>{t('vaultTransfer.title') || 'Cloud Vault Restore'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {hasLocalKey && !qrData ? (
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
              <AppIcon name="lock" size={32} color={colors.gold} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.textMain }]}>{t('vaultTransfer.localKeyFoundTitle') || 'Key Present on Device'}</Text>
            <Text style={[styles.cardDesc, { color: colors.textSub }]}>
              {t('vaultTransfer.localKeyFoundDesc') ||
                'Your master credentials are saved on this device. You can directly decrypt and restore your cloud vault.'}
            </Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleLocalRestore} disabled={isTransferring}>
              <LinearGradient
                colors={colors.goldGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                {isTransferring ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {t('vaultTransfer.restoreNowBtn') || 'Restore Cloud Vault'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
              onPress={startQrReceiveSession}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.gold }]}>
                {t('vaultTransfer.transferFromOtherDevice') || 'Transfer from Another Device instead'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
              <AppIcon name="scan" size={32} color={colors.gold} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.textMain }]}>
              {t('vaultTransfer.scanFromOtherDeviceTitle') || 'Authorize via Other Device'}
            </Text>
            <Text style={[styles.cardDesc, { color: colors.textSub }]}>
              {t('vaultTransfer.scanFromOtherDeviceDesc') ||
                'Scan this QR code with your other device where FlakeSecure is already unlocked. The encryption key will be sent end-to-end encrypted.'}
            </Text>

            {qrData ? (
              <View style={styles.qrWrapper}>
                <View style={[styles.qrCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <QRCode value={qrData} size={220} backgroundColor="transparent" color={isDark ? '#fff' : '#07090e'} />
                </View>
                <Text style={[styles.qrStatusText, { color: colors.textSub }]}>
                  {transferStatus || t('vaultTransfer.waitingForScan') || 'Waiting for scan…'}
                </Text>
                <ActivityIndicator size="small" color={colors.gold} style={{ marginTop: 8 }} />
              </View>
            ) : (
              <ActivityIndicator size="large" color={colors.gold} style={{ marginVertical: 30 }} />
            )}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
              <Text style={[styles.cancelLinkText, { color: colors.textMuted }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  backBtnText: {
    fontSize: 20,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    padding: 20,
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 14,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 22,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
  },
  gradientBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 18,
  },
  qrWrapper: {
    alignItems: 'center',
    marginVertical: 10,
  },
  qrCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  qrStatusText: {
    fontSize: 13,
    marginTop: 14,
    textAlign: 'center',
  },
  cancelLink: {
    paddingVertical: 8,
  },
  cancelLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VaultTransferScreen;
