/**
 * ============================================================================
 * FlakeSecure Mobile App - QR-Code Scanner Screen (ScanScreen)
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Vibration, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { AppIcon } from '../components/CategoryIcons';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { encryptCredentials, decryptCredentials } from '../utils/crypto';
import { saveCredentials, getFullVaultExport, findCredentialsForDomain } from '../utils/storage';
import { getServerUrl, notifyQrScanned } from '../utils/api';

const FRAME_SIZE = 250;

export default function ScanScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [importing, setImporting] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1, duration: 2000, useNativeDriver: true
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0, duration: 2000, useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || importing) return;
    
    const hasSid = data.includes('sid=') || data.includes('s=');
    const hasKey = data.includes('key=') || data.includes('k=');
    if (!hasSid || !hasKey) {
      return;
    }

    setScanned(true);
    Vibration.vibrate(100);

    try {
      let sid = null;
      let key = null;
      let domain = null;
      let action = null;
      let fieldsParam = null;

      let queryString = '';
      if (data.includes('?')) {
        queryString = data.split('?')[1];
      } else if (data.includes('#')) {
        queryString = data.split('#')[1];
      }

      if (queryString) {
        try {
          const urlParams = new URLSearchParams(queryString);
          sid = urlParams.get('s') || urlParams.get('sid');
          key = urlParams.get('k') || urlParams.get('key');
          domain = urlParams.get('d') || urlParams.get('domain');
          action = urlParams.get('a') || urlParams.get('action');
          fieldsParam = urlParams.get('f') || urlParams.get('fields');
        } catch (e) {
          console.log('[FlakeSecure Scanner] URLSearchParams failed, using manual parser');
        }

        if (!sid || !key) {
          const pairs = queryString.split('&');
          for (const pair of pairs) {
            const eqIdx = pair.indexOf('=');
            if (eqIdx === -1) continue;
            const k = decodeURIComponent(pair.substring(0, eqIdx)).toLowerCase();
            const v = decodeURIComponent(pair.substring(eqIdx + 1));
            if (k === 's' || k === 'sid') sid = v;
            else if (k === 'k' || k === 'key') key = v;
            else if (k === 'd' || k === 'domain') domain = v;
            else if (k === 'a' || k === 'action') action = v;
            else if (k === 'f' || k === 'fields') fieldsParam = v;
          }
        }
      }

      if (!sid || !key) {
        throw new Error('Invalid QR code parameters');
      }

      const isVaultTransfer = action === 'vault_key_transfer' || action === 'vault-transfer' || data.includes('vault-transfer');
      const isRegister = !isVaultTransfer && (action === 'register' || action === 'r' || data.includes('register') || !!fieldsParam);
      const isShare = !isVaultTransfer && (data.includes('share') || !domain) && !isRegister;

      if (isVaultTransfer) {
        setImporting(true);
        const rawCreds = await SecureStore.getItemAsync('auth_credentials');
        if (!rawCreds) {
          Alert.alert(
            t('error'),
            t('vaultTransfer.noKeyOnDeviceToAuthorize') || 'Dieses Gerät besitzt keine gespeicherten Tresor-Schlüssel zur Autorisierung.'
          );
          setScanned(false);
          setImporting(false);
          return;
        }

        const localCreds = JSON.parse(rawCreds);
        if (!localCreds || !localCreds.password) {
          Alert.alert(
            t('error'),
            t('vaultTransfer.noKeyOnDeviceToAuthorize') || 'Dieses Gerät besitzt keine gespeicherten Tresor-Schlüssel zur Autorisierung.'
          );
          setScanned(false);
          setImporting(false);
          return;
        }

        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: t('vaultTransfer.authorizeBiometricPrompt') || 'Neues Gerät für Cloud-Tresor autorisieren',
          fallbackLabel: 'PIN verwenden',
          disableDeviceFallback: false,
        });

        if (!authResult.success) {
          setScanned(false);
          setImporting(false);
          return;
        }

        const localVault = await getFullVaultExport();

        const packetToEncrypt = {
          password: localCreds.password,
          identifier: localCreds.identifier || localCreds.email,
          email: localCreds.email || localCreds.identifier,
          username: localCreds.username || '',
          vaultData: localVault,
          transferredAt: new Date().toISOString()
        };

        const encrypted = await encryptCredentials(packetToEncrypt, key);

        const serverUrl = await getServerUrl();
        const response = await fetch(`${serverUrl}/api/share/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sid, payload: encrypted, hidden: false, expiresInHours: 1 })
        });

        if (!response.ok) {
          throw new Error('Fehler beim Senden des Autorisierungs-Schlüssels.');
        }

        Alert.alert(
          t('success'),
          t('vaultTransfer.authorizeSentSuccess') || 'Schlüssel erfolgreich übertragen! Das andere Gerät stellt den Tresor nun wieder her.',
          [{ text: t('ok'), onPress: () => navigation.navigate('Home') }]
        );
        return;
      } else if (isRegister && domain) {
        notifyQrScanned(sid, user?.username || '').catch(() => {});
        let fields = [];
        if (fieldsParam) {
          const decoded = decodeURIComponent(fieldsParam).trim();
          if (decoded.startsWith('[') || decoded.startsWith('{')) {
            try {
              fields = JSON.parse(decoded);
            } catch (e) {}
          } else {
            const COMPACT_MAP = {
              e: { key: 'email', label: 'E-Mail', type: 'email', required: true },
              u: { key: 'username', label: 'Benutzername', type: 'text', required: true },
              p: { key: 'password', label: 'Passwort', type: 'password', required: true },
              cp: { key: 'confirmPassword', label: 'Passwort wiederholen', type: 'password', required: true },
              fn: { key: 'firstName', label: 'Vorname', type: 'text', required: false },
              ln: { key: 'lastName', label: 'Nachname', type: 'text', required: false },
              name: { key: 'fullName', label: 'Vollständiger Name', type: 'text', required: false },
              ph: { key: 'phone', label: 'Telefonnummer', type: 'tel', required: false }
            };
            const codes = decoded.split(',').map(c => c.trim()).filter(Boolean);
            fields = codes.map(code => COMPACT_MAP[code] || { key: code, label: code, type: 'text', required: false });
          }
        }
        navigation.replace('RegisterFill', {
          sid,
          key,
          domain: decodeURIComponent(domain),
          fields
        });
      } else if (isShare) {
        setImporting(true);
        const serverUrl = await getServerUrl();
        const response = await fetch(`${serverUrl}/api/share/consume/${sid}`);
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to fetch shared data (code expired or already used)');
        }

        let { payload: payloadRaw, hidden, expiresInHours } = await response.json();
        if (typeof payloadRaw === 'string') {
          try {
            payloadRaw = JSON.parse(payloadRaw);
          } catch (e) {}
        }

        const decryptedJson = await decryptCredentials(payloadRaw, key);
        let credsToImport = JSON.parse(decryptedJson);

        if (typeof credsToImport === 'string') {
          credsToImport = JSON.parse(credsToImport);
        }
        if (!Array.isArray(credsToImport)) {
          credsToImport = [credsToImport];
        }

        let savedCount = 0;
        for (const newCred of credsToImport) {
          if (newCred && newCred.domain && newCred.username) {
            await saveCredentials(newCred.domain, newCred.username, newCred.password || '', {
              ...(hidden && { hidden: true }),
              ...(expiresInHours && { expiresAt: new Date(Date.now() + expiresInHours * 3600000).toISOString() }),
              sharedBy: 'shared'
            });
            savedCount++;
          }
        }

        Alert.alert(
          'Import Successful',
          `Successfully imported ${savedCount} credential${savedCount === 1 ? '' : 's'}.`,
          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
        );
      } else {
        const cleanDomain = decodeURIComponent(domain);
        findCredentialsForDomain(cleanDomain)
          .then((cred) => {
            const u = cred?.username || user?.username || '';
            notifyQrScanned(sid, u);
          })
          .catch(() => {
            notifyQrScanned(sid, user?.username || '');
          });
        navigation.replace('Confirm', { sid, key, domain: cleanDomain });
      }
    } catch (err) {
      setScanned(false);
      setImporting(false);
      Alert.alert('Scan Error', err.message || 'Failed to process QR code');
    }
  };

  if (!permission) {
    return <View style={[styles.container, { backgroundColor: colors.bg }]} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.permissionContainer}>
          <AppIcon name="scan" size={48} color={colors.gold} style={{ marginBottom: 16 }} />
          <Text style={[styles.permTitle, { color: colors.textMain }]}>{t('scan.title')}</Text>
          <Text style={[styles.permText, { color: colors.textSub }]}>
            {t('scan.permission')}
          </Text>
          <TouchableOpacity
            style={[styles.permButton, { backgroundColor: colors.gold }]}
            onPress={requestPermission}
          >
            <Text style={styles.permButtonText}>{t('scan.requestPermission')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backLink, { color: colors.textMuted }]}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_SIZE - 30]
  });

  const isLayoutReady = layout.width > 0 && layout.height > 0;
  const maskTopBottom = isLayoutReady ? (layout.height - FRAME_SIZE) / 2 : 0;
  const maskSides = isLayoutReady ? (layout.width - FRAME_SIZE) / 2 : 0;

  return (
    <View 
      style={[styles.container, { backgroundColor: '#000' }]} 
      onLayout={(e) => setLayout(e.nativeEvent.layout)}
    >
      {isLayoutReady && (
        <>
          <CameraView
            style={{ position: 'absolute', top: 0, left: 0, width: layout.width, height: layout.height }}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />

          <View style={[styles.mask, { top: 0, left: 0, right: 0, height: maskTopBottom }]} />
          <View style={[styles.mask, { bottom: 0, left: 0, right: 0, height: maskTopBottom }]} />
          <View style={[styles.mask, { top: maskTopBottom, bottom: maskTopBottom, left: 0, width: maskSides }]} />
          <View style={[styles.mask, { top: maskTopBottom, bottom: maskTopBottom, right: 0, width: maskSides }]} />

          <View style={[styles.scanFrameContainer, {
            left: maskSides, top: maskTopBottom, width: FRAME_SIZE, height: FRAME_SIZE
          }]} pointerEvents="none">
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL, { borderColor: colors.gold }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: colors.gold }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: colors.gold }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: colors.gold }]} />
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }], backgroundColor: colors.gold, shadowColor: colors.gold }]} />
            </View>
          </View>

          <View style={styles.uiContainer} pointerEvents="box-none">
            <SafeAreaView style={styles.headerContainer}>
              <View style={styles.header}>
                <AppIcon name="snowflake" size={20} color={colors.gold} style={{ marginRight: 6 }} />
                <Text style={styles.logoText}>FlakeSecure</Text>
              </View>
            </SafeAreaView>
          </View>

          <View style={{
            position: 'absolute',
            top: maskTopBottom + FRAME_SIZE + 40,
            left: 0,
            right: 0,
            alignItems: 'center',
            gap: 20
          }} pointerEvents="box-none">
            {importing ? (
              <View style={{ alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={styles.instruction}>Importing credentials…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.instruction}>
                  {t('scan.title')}
                </Text>
                <TouchableOpacity
                  style={[styles.cancelBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={[styles.cancelText, { color: colors.textSub }]}>{t('cancel')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(7,9,14,0.78)',
  },
  scanFrameContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute', width: 28, height: 28,
    borderWidth: 3
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanLine: {
    position: 'absolute', left: 4, right: 4, height: 2,
    top: 15,
    shadowRadius: 6, shadowOpacity: 0.8
  },
  uiContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  headerContainer: {
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16
  },
  logoText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  instruction: {
    color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center'
  },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12
  },
  cancelText: { fontSize: 14, fontWeight: '600' },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  permText: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  permButton: {
    borderRadius: 8,
    paddingHorizontal: 28, paddingVertical: 14, marginBottom: 16
  },
  permButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  backLink: { fontSize: 14, fontWeight: '600' }
});
