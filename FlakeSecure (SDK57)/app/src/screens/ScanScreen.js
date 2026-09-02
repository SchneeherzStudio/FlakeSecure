/**
 * ============================================================================
 * FlakeSecure Mobile App - QR-Code Scanner Screen (ScanScreen)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. CAMERA PERMISSIONS & SCAN-LINE ANIMATION:
 *    - Requests camera access via useCameraPermissions (expo-camera).
 *    - Renders animated laser scan line and responsive backdrop viewfinder mask.
 * 
 * 2. QR PARSING & DISPATCH (handleBarCodeScanned):
 *    - Validates FlakeSecure QR payloads (session ID, AES key, domain, action, fields).
 *    - Registration Mode: Decodes required form fields and navigates to RegisterFillScreen.
 *    - Share / Import Mode: Fetches /api/share/consume/:sid, decrypts credentials via AES-256-CTR/HMAC, and persists them into SecureStore.
 *    - Web Login Mode: Navigates to ConfirmScreen for biometric confirmation (Face ID / Fingerprint).
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
import { useLanguage } from '../context/LanguageContext';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { encryptCredentials, decryptCredentials } from '../utils/crypto';
import { saveCredentials, getFullVaultExport } from '../utils/storage';

const SERVER_URL = 'https://flakesecure.snowystudio.dev';
const FRAME_SIZE = 250;

export default function ScanScreen() {
  const navigation = useNavigation();
  const { t } = useLanguage();
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
    
    console.log('[FlakeSecure Scanner] Raw QR data:', JSON.stringify(data));
    
    const hasSid = data.includes('sid=') || data.includes('s=');
    const hasKey = data.includes('key=') || data.includes('k=');
    if (!hasSid || !hasKey) {
      console.log('[FlakeSecure Scanner] Not a FlakeSecure QR code, ignoring');
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

      // Extract query string – support both ? and # separators
      let queryString = '';
      if (data.includes('?')) {
        queryString = data.split('?')[1];
      } else if (data.includes('#')) {
        queryString = data.split('#')[1];
      }

      if (queryString) {
        // Try URLSearchParams first
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

        // Manual fallback if URLSearchParams didn't work
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

      console.log('[FlakeSecure Scanner] Parsed: sid=', sid?.substring(0, 8), 'key=', key?.substring(0, 8), 'domain=', domain);

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

        // Request biometric approval on authorizing device
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

        // Retrieve local vault data to include in direct device-to-device transfer
        const localVault = await getFullVaultExport();

        // Encrypt the master credentials payload and full vault data with the scanned ephemeral key
        const packetToEncrypt = {
          password: localCreds.password,
          identifier: localCreds.identifier || localCreds.email,
          email: localCreds.email || localCreds.identifier,
          username: localCreds.username || '',
          vaultData: localVault,
          transferredAt: new Date().toISOString()
        };

        const encrypted = await encryptCredentials(packetToEncrypt, key);

        // Send to share relay endpoint for one-time pickup
        const response = await fetch(`${SERVER_URL}/api/share/create`, {
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
        const response = await fetch(`${SERVER_URL}/api/share/consume/${sid}`);
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
        navigation.replace('Confirm', { sid, key, domain: decodeURIComponent(domain) });
      }
    } catch (err) {
      setScanned(false);
      setImporting(false);
      Alert.alert('Scan Error', err.message || 'Failed to process QR code');
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permIcon}>📷</Text>
          <Text style={styles.permTitle}>{t('scan.title')}</Text>
          <Text style={styles.permText}>
            {t('scan.permission')}
          </Text>
          <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
            <Text style={styles.permButtonText}>{t('scan.requestPermission')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>{t('common.back')}</Text>
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
      style={styles.container} 
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
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]} />
            </View>
          </View>

          <View style={styles.uiContainer} pointerEvents="box-none">
            <SafeAreaView style={styles.headerContainer}>
              <View style={styles.header}>
                <Text style={styles.logoText}>❄️ FlakeSecure</Text>
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
                <ActivityIndicator size="large" color="#6391ff" />
                <Text style={styles.instruction}>Importing credentials…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.instruction}>
                  {t('scan.title')}
                </Text>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
                  <Text style={styles.cancelText}>{t('cancel')}</Text>
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
  container: { flex: 1, backgroundColor: '#000' },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(9,11,20,0.75)',
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
    borderColor: '#6391ff', borderWidth: 3
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanLine: {
    position: 'absolute', left: 4, right: 4, height: 2,
    top: 15,
    backgroundColor: '#6391ff',
    shadowColor: '#6391ff', shadowRadius: 6, shadowOpacity: 0.8
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
  footerContainer: {
    paddingBottom: 40,
    alignItems: 'center',
    gap: 20
  },
  instruction: {
    color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center'
  },
  instructionBold: { color: '#fff', fontWeight: '700' },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12
  },
  cancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permIcon: { fontSize: 48, marginBottom: 16 },
  permTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  permText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 24 },
  permButton: {
    backgroundColor: '#6391ff', borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14, marginBottom: 16
  },
  permButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backLink: { color: 'rgba(255,255,255,0.4)', fontSize: 14 }
});
