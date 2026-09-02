/**
 * ============================================================================
 * FlakeSecure Mobile App - Cloud Vault Restore & Cross-Device Key Transfer
 * (VaultTransferScreen) v2.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & SECURITY WORKFLOW:
 * 
 * 1. LOCAL KEY RESTORATION (Key on Device):
 *    - Checks if auth_credentials exists in SecureStore on the current device.
 *    - Requests user confirmation and biometric authentication (Face ID / Fingerprint).
 *    - Fetches the zero-knowledge encrypted vault from /api/vault/sync, derives the AES key locally, decrypts, and populates local SecureStore.
 * 
 * 2. CROSS-DEVICE ZERO-KNOWLEDGE KEY TRANSFER (No Key on Device):
 *    - Generates an ephemeral 256-bit AES session key and a 16-byte session ID (sid).
 *    - Displays an optical QR code (flakesecure://vault-transfer?sid=...&key=...).
 *    - The authorizing device scans the QR code, approves via biometrics, encrypts the vault key with the ephemeral AES key, and relays the ciphertext.
 *    - The receiving device consumes the payload once, decrypts the vault key, restores the cloud vault, saves authenticated credentials, and IMMEDIATELY WIPES the ephemeral transfer key from memory.
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ExpoCrypto from 'expo-crypto';

import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { syncVaultFromServer, syncVaultToServer } from '../utils/vault';
import { decryptCredentials, bytesToHex } from '../utils/crypto';
import { getAllCredentials, importFullVault } from '../utils/storage';

const SERVER_URL = 'https://flakesecure.snowystudio.dev';

export function VaultTransferScreen({ route, navigation }) {
  const { t } = useLanguage();
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
        fallbackLabel: 'PIN verwenden',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        return;
      }

      setCheckingLocal(true);
      setTransferStatus(t('vaultTransfer.downloading') || 'Downloading cloud vault…');

      const success = await syncVaultFromServer(
        localCreds.password,
        localCreds.identifier,
        localCreds.email || user?.email
      );

      if (success) {
        const all = await getAllCredentials();
        Alert.alert(
          t('success'),
          t('vaultTransfer.restoreSuccess', { count: all.length }) ||
            `Vault successfully restored (${all.length} logins).`,
          [{ text: t('ok'), onPress: () => navigation.navigate('Home') }]
        );
      } else {
        Alert.alert(
          t('error'),
          t('vaultTransfer.restoreFailed') ||
            'Could not restore vault. No cloud backup found or key mismatch.',
          [
            { text: t('cancel'), style: 'cancel' },
            {
              text: t('vaultTransfer.tryDeviceTransfer') || 'Transfer from another device',
              onPress: () => startQrReceiveSession(),
            },
          ]
        );
      }
    } catch (err) {
      Alert.alert(t('error'), err.message || 'Restoration failed.');
    } finally {
      if (isMountedRef.current) setCheckingLocal(false);
    }
  };

  const startQrReceiveSession = async () => {
    try {
      setIsTransferring(true);
      setTransferStatus(t('vaultTransfer.generatingSession') || 'Generating secure transfer session…');

      const sidBytes = await ExpoCrypto.getRandomBytesAsync(16);
      const sid = bytesToHex(sidBytes);
      const keyBytes = await ExpoCrypto.getRandomBytesAsync(32);
      const keyHex = bytesToHex(keyBytes);

      setActiveSid(sid);
      setTransferKeyHex(keyHex);

      const qrString = `flakesecure://vault-transfer?sid=${sid}&key=${keyHex}&u=${encodeURIComponent(
        user?.username || ''
      )}&action=vault_key_transfer`;

      setQrData(qrString);
      setTransferStatus(t('vaultTransfer.waitingForScan') || 'Waiting for authorized device to scan…');
    } catch (err) {
      Alert.alert(t('error'), 'Failed to generate transfer QR session');
      setIsTransferring(false);
    }
  };

  // Poll for transfer consumption
  useEffect(() => {
    if (!activeSid || !transferKeyHex) return;

    let timer = null;
    let isCancelled = false;

    const pollSession = async () => {
      if (isCancelled || !isMountedRef.current) return;
      try {
        const res = await fetch(`${SERVER_URL}/api/share/consume/${activeSid}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data && data.payload) {
          isCancelled = true;
          clearInterval(timer);
          await processReceivedKeyPayload(data.payload, transferKeyHex);
        }
      } catch (e) {}
    };

    timer = setInterval(pollSession, 1200);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [activeSid, transferKeyHex]);

  const processReceivedKeyPayload = async (rawPayload, sessionKeyHex) => {
    try {
      setTransferStatus(t('vaultTransfer.decrypting') || 'Decrypting vault key…');

      let payloadToDecrypt = rawPayload;
      if (typeof payloadToDecrypt === 'string') {
        try {
          payloadToDecrypt = JSON.parse(payloadToDecrypt);
        } catch (e) {}
      }
      if (typeof payloadToDecrypt === 'string') {
        try {
          payloadToDecrypt = JSON.parse(payloadToDecrypt);
        } catch (e) {}
      }

      const decryptedJson = await decryptCredentials(payloadToDecrypt, sessionKeyHex);
      if (!decryptedJson) {
        throw new Error('HMAC verification failed on transferred payload.');
      }

      let keyData = typeof decryptedJson === 'string' ? JSON.parse(decryptedJson) : decryptedJson;
      if (typeof keyData === 'string') {
        keyData = JSON.parse(keyData);
      }
      const { password, identifier, email, username } = keyData;

      if (!password) {
        throw new Error('No valid password key found in transfer packet.');
      }

      // 1. Direct P2P import from authorizing device
      let directImported = false;
      if (
        keyData.vaultData &&
        ((keyData.vaultData.credentials && keyData.vaultData.credentials.length > 0) ||
          (keyData.vaultData.totpItems && keyData.vaultData.totpItems.length > 0))
      ) {
        console.log('[VaultTransfer] Direct importing vaultData from authorizing device...');
        await importFullVault(keyData.vaultData);
        directImported = true;
      }

      // 2. Save credentials into local SecureStore
      await SecureStore.setItemAsync(
        'auth_credentials',
        JSON.stringify({
          identifier: identifier || email || username,
          email: email || identifier,
          username: username || identifier,
          password: password,
        })
      );

      // 3. Fallback to server sync or heal server vault
      if (!directImported) {
        setTransferStatus(t('vaultTransfer.downloading') || 'Restoring cloud vault with transferred key…');
        await syncVaultFromServer(password, identifier, email);
      } else {
        syncVaultToServer(password, identifier, email).catch(() => {});
      }

      // WIPE EPHEMERAL TRANSFER KEYS FROM MEMORY
      setTransferKeyHex(null);
      setActiveSid(null);
      setQrData(null);

      const all = await getAllCredentials();
      Alert.alert(
        t('success'),
        t('vaultTransfer.transferSuccess', { count: all.length }) ||
          `Vault key transferred! ${all.length} logins restored on this device.`,
        [{ text: t('ok'), onPress: () => navigation.navigate('Home') }]
      );
    } catch (err) {
      console.log('[VaultTransfer] Process error:', err.message);
      Alert.alert(t('error'), err.message || 'Key transfer decryption failed.');
      startQrReceiveSession();
    }
  };

  const handleCancel = async () => {
    if (activeSid) {
      fetch(`${SERVER_URL}/api/share/cancel/${activeSid}`, { method: 'DELETE' }).catch(() => {});
    }
    setTransferKeyHex(null);
    setActiveSid(null);
    setQrData(null);
    navigation.goBack();
  };

  if (checkingLocal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#6391ff" />
          <Text style={styles.loadingText}>{transferStatus || t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('vaultTransfer.title') || 'Cloud Vault Restore'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {hasLocalKey && !qrData ? (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>🔐</Text>
            </View>
            <Text style={styles.cardTitle}>{t('vaultTransfer.localKeyFoundTitle') || 'Key Present on Device'}</Text>
            <Text style={styles.cardDesc}>
              {t('vaultTransfer.localKeyFoundDesc') ||
                'Your master credentials are saved on this device. You can directly decrypt and restore your cloud vault.'}
            </Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleLocalRestore}>
              <LinearGradient
                colors={['#6391ff', '#7c6aff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                <Text style={styles.primaryBtnText}>
                  ☁️ {t('vaultTransfer.restoreNowBtn') || 'Restore Cloud Vault'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.secondaryBtn} onPress={startQrReceiveSession}>
              <Text style={styles.secondaryBtnText}>
                📲 {t('vaultTransfer.transferFromOtherDevice') || 'Transfer from Another Device instead'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>📲</Text>
            </View>
            <Text style={styles.cardTitle}>
              {t('vaultTransfer.scanFromOtherDeviceTitle') || 'Authorize via Other Device'}
            </Text>
            <Text style={styles.cardDesc}>
              {t('vaultTransfer.scanFromOtherDeviceDesc') ||
                'Scan this QR code with your other device where FlakeSecure is already unlocked. The encryption key will be sent end-to-end encrypted.'}
            </Text>

            {qrData ? (
              <View style={styles.qrWrapper}>
                <View style={styles.qrCard}>
                  <QRCode value={qrData} size={220} backgroundColor="transparent" color="#fff" />
                </View>
                <Text style={styles.qrStatusText}>
                  {transferStatus || t('vaultTransfer.waitingForScan') || 'Waiting for scan…'}
                </Text>
                <ActivityIndicator size="small" color="#6391ff" style={{ marginTop: 8 }} />
              </View>
            ) : (
              <ActivityIndicator size="large" color="#6391ff" style={{ marginVertical: 30 }} />
            )}

            <View style={styles.divider} />

            <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
              <Text style={styles.cancelLinkText}>{t('cancel')}</Text>
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
    backgroundColor: '#090b14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  backBtnText: {
    color: '#6391ff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#fff',
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
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 14,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 145, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconEmoji: {
    fontSize: 32,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardDesc: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  gradientBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    width: '100%',
  },
  secondaryBtnText: {
    color: '#6391ff',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 18,
  },
  qrWrapper: {
    alignItems: 'center',
    marginVertical: 10,
  },
  qrCard: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  qrStatusText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    marginTop: 14,
    textAlign: 'center',
  },
  cancelLink: {
    paddingVertical: 8,
  },
  cancelLinkText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VaultTransferScreen;
