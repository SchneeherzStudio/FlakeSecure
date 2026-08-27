/**
 * ============================================================================
 * FlakeSecure Mobile App - Credential Sharing & Device Import (ShareImportScreen)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. EXPORT & SHARING MODE:
 *    - loadCredentials(): Loads stored credentials for multi-selection (checkboxes / select all).
 *    - handleGenerateQR(): Generates a cryptographically secure 32-byte one-time key and session ID, encrypts selected credentials via AES-256-CTR + HMAC-SHA256, registers the share session (/api/share/create), and displays the QR code.
 *    - Polls /api/share/status/:sid for automated consumption notifications.
 * 
 * 2. IMPORT MODE (processImportPayload / handleBarCodeScanned):
 *    - Scans sender QR code using CameraView.
 *    - Fetches encrypted payload from /api/share/consume/:sid, decrypts it, and saves imported credentials into local SecureStore.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { getAllCredentials, saveCredentials, getCredentialsForDomain } from '../utils/storage';
import { i18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { encryptCredentials, decryptCredentials, hexToBytes, bytesToHex } from '../utils/crypto';
import * as ExpoCrypto from 'expo-crypto';

const SERVER_URL = 'https://flakesecure.snowystudio.dev';

export default function ShareImportScreen({ route, navigation }) {
  const { mode } = route.params || { mode: 'import' };
  const { user } = useAuth();
  
  const [credentials, setCredentials] = useState([]);
  const [selectedCreds, setSelectedCreds] = useState({});
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [activeSid, setActiveSid] = useState(null);
  
  const [recipient, setRecipient] = useState('');
  const [hideFromRecipient, setHideFromRecipient] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState(null);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (mode === 'export' || mode === 'share') {
      loadCredentials();
    }
    if (route.params?.sid && route.params?.key) {
      processImportPayload(route.params.sid, route.params.key);
    }
  }, [mode, route.params]);

  useEffect(() => {
    if (!activeSid || !qrData) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/share/status/${activeSid}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'consumed') {
          clearInterval(interval);
          if (isMounted) {
            setQrData(null);
            setActiveSid(null);
            Alert.alert(
              i18n.t('success'),
              mode === 'share' ? i18n.t('share.shareSuccessAlert') : i18n.t('share.exportSuccessAlert'),
              [{ text: i18n.t('ok'), onPress: () => navigation.goBack() }]
            );
          }
        } else if (data.status === 'expired') {
          clearInterval(interval);
          if (isMounted) {
            setQrData(null);
            setActiveSid(null);
            Alert.alert(i18n.t('error'), i18n.t('share.exportFailedAlert'));
          }
        }
      } catch (err) {
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeSid, qrData, mode, navigation]);

  const loadCredentials = async () => {
    try {
      const creds = await getAllCredentials();
      setCredentials(creds || []);
    } catch (e) {
      console.log('Failed to load credentials', e);
    }
  };

  const toggleSelection = (domain) => {
    setSelectedCreds(prev => ({
      ...prev,
      [domain]: !prev[domain]
    }));
  };

  const selectAll = () => {
    const allSelected = credentials.every(c => selectedCreds[c.domain]);
    const nextState = {};
    if (!allSelected) {
      credentials.forEach(c => nextState[c.domain] = true);
    }
    setSelectedCreds(nextState);
  };

  const handleGenerateQR = async () => {
    const selectedList = credentials.filter(c => selectedCreds[c.domain]);
    if (selectedList.length === 0) {
      Alert.alert(i18n.t('error'), i18n.t('share.nothingSelected') || 'No credentials selected');
      return;
    }
    if (mode === 'share' && !recipient.trim()) {
      Alert.alert(i18n.t('error'), 'Please enter a recipient username');
      return;
    }

    try {
      setLoading(true);
      const keyBytes = await ExpoCrypto.getRandomBytesAsync(32);
      const keyHex = bytesToHex(keyBytes);
      const sidBytes = await ExpoCrypto.getRandomBytesAsync(16);
      const sid = bytesToHex(sidBytes);

      const fullCredentials = [];
      for (const cred of selectedList) {
        const full = await getCredentialsForDomain(cred.domain);
        if (full) {
          fullCredentials.push({ domain: cred.domain, username: full.username, password: full.password });
        }
      }
      if (fullCredentials.length === 0) {
        Alert.alert(i18n.t('error'), 'Could not read credential data');
        setLoading(false);
        return;
      }
      
      const encrypted = await encryptCredentials(fullCredentials, keyHex);

      const token = await SecureStore.getItemAsync('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${SERVER_URL}/api/share/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          sid, 
          payload: encrypted, 
          recipient: mode === 'share' ? recipient.trim() : undefined,
          hidden: mode === 'share' ? hideFromRecipient : false,
          expiresInHours: mode === 'share' ? expiresInHours : null
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create session on server');
      }

      const qrUrl = `https://flakesecure.snowystudio.dev/share?sid=${sid}&key=${keyHex}`;
      setActiveSid(sid);
      setQrData(qrUrl);
      
    } catch (error) {
      Alert.alert(i18n.t('error'), error.message || 'Failed to generate export data');
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const processImportPayload = async (sid, keyHex) => {
    try {
      setLoading(true);
      const response = await fetch(`${SERVER_URL}/api/share/consume/${sid}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch shared data (code expired or already used)');
      }
      
      let { payload: payloadRaw, hidden, expiresInHours } = await response.json();
      if (typeof payloadRaw === 'string') {
        try {
          payloadRaw = JSON.parse(payloadRaw);
        } catch (e) {
        }
      }
      const decryptedJson = await decryptCredentials(payloadRaw, keyHex);
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

      Alert.alert('Import Successful', `Successfully imported ${savedCount} credential${savedCount === 1 ? '' : 's'}.`);
      setTimeout(() => navigation.navigate('Home'), 1500);
    } catch (error) {
      Alert.alert('Import Error', error.message || 'Failed to process import data');
    } finally {
      setLoading(false);
      setScanned(false);
    }
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned) return;
    setScanned(true);

    try {
      let sid = null;
      let keyHex = null;

      if (data.includes('?')) {
        const query = data.split('?')[1];
        const urlParams = new URLSearchParams(query);
        sid = urlParams.get('sid');
        keyHex = urlParams.get('key');
      }

      if (sid && keyHex) {
        await processImportPayload(sid, keyHex);
      } else {
        Alert.alert('Invalid QR', 'This QR code is not valid for FlakeSecure imports.');
        setScanned(false);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to process QR code');
      setScanned(false);
    }
  };

  const renderExportShare = () => (
    <View style={styles.content}>
      {mode === 'share' && (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Recipient Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={recipient}
            onChangeText={(text) => setRecipient(text.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      {mode === 'share' && (
        <View style={styles.shareOptions}>
          <TouchableOpacity 
            style={styles.optionRow} 
            onPress={() => setHideFromRecipient(!hideFromRecipient)}
          >
            <View style={[styles.optionCheck, hideFromRecipient && styles.optionCheckActive]}>
              {hideFromRecipient && <Text style={styles.optionCheckMark}>✓</Text>}
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>Recipient can't see logins</Text>
              <Text style={styles.optionDesc}>Credentials will auto-fill but remain hidden</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Auto-delete after</Text>
            <View style={styles.expiryBtns}>
              {[null, 1, 24, 168, 720].map(hours => (
                <TouchableOpacity 
                  key={hours ?? 'never'}
                  style={[styles.expiryBtn, expiresInHours === hours && styles.expiryBtnActive]}
                  onPress={() => setExpiresInHours(hours)}
                >
                  <Text style={[styles.expiryBtnText, expiresInHours === hours && styles.expiryBtnTextActive]}>
                    {hours === null ? 'Never' : hours === 1 ? '1h' : hours === 24 ? '1d' : hours === 168 ? '7d' : '30d'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      <View style={styles.listHeader}>
        <Text style={styles.label}>Select Credentials to {mode === 'share' ? 'Share' : 'Export'}</Text>
        <TouchableOpacity onPress={selectAll}>
          <Text style={styles.selectAllText}>Toggle All</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.list}>
        {credentials.map(cred => (
          <TouchableOpacity 
            key={cred.domain} 
            style={[styles.credItem, selectedCreds[cred.domain] && styles.credItemSelected]}
            onPress={() => toggleSelection(cred.domain)}
          >
            <View style={styles.credInfo}>
              <Text style={styles.credTitle}>{cred.title}</Text>
              <Text style={styles.credUsername}>{cred.username}</Text>
            </View>
            <View style={[styles.checkbox, selectedCreds[cred.domain] && styles.checkboxChecked]}>
              {selectedCreds[cred.domain] && <Text style={styles.checkMark}>✓</Text>}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {qrData ? (
        <View style={styles.qrContainer}>
          <QRCode value={qrData} size={200} backgroundColor="transparent" color="#fff" />
          <Text style={styles.qrInstructions}>{i18n.t('share.waitingForScan')}</Text>
          <TouchableOpacity
            style={styles.cancelQrBtn}
            onPress={async () => {
              if (activeSid) {
                await fetch(`${SERVER_URL}/api/share/cancel/${activeSid}`, { method: 'DELETE' }).catch(() => {});
              }
              setQrData(null);
              setActiveSid(null);
            }}
          >
            <Text style={styles.cancelQrBtnText}>{i18n.t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={handleGenerateQR} disabled={loading}>
          <LinearGradient colors={['#6391ff', '#7c6aff']} style={styles.actionBtn}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>{i18n.t('share.showQr')}</Text>}
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderImport = () => {
    if (!permission) return <View />;
    if (!permission.granted) {
      return (
        <View style={styles.centerContent}>
          <Text style={styles.text}>We need your permission to show the camera</Text>
          <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <View style={styles.cameraContainer}>
        <Text style={styles.instructionText}>Scan the QR code shown on your other device</Text>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
        {scanned && (
          <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <Text style={styles.rescanText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getTitle = () => {
    if (mode === 'import') return 'Import Data';
    if (mode === 'export') return 'Export Data';
    return 'Share Data';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{getTitle()}</Text>
      </View>
      
      {(mode === 'export' || mode === 'share') ? renderExportShare() : renderImport()}
      
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
    paddingVertical: 15,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderRadius: 14,
    color: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  shareOptions: {
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    gap: 15,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckActive: {
    backgroundColor: '#6391ff',
    borderColor: '#6391ff',
  },
  optionCheckMark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  optionDesc: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  expiryBtns: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  expiryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  expiryBtnActive: {
    backgroundColor: '#6391ff',
  },
  expiryBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  expiryBtnTextActive: {
    color: '#fff',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectAllText: {
    color: '#6391ff',
    fontSize: 14,
  },
  list: {
    flex: 1,
    marginBottom: 20,
  },
  credItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    marginBottom: 10,
  },
  credItemSelected: {
    borderColor: '#6391ff',
    backgroundColor: 'rgba(99,145,255,0.1)',
  },
  credInfo: {
    flex: 1,
  },
  credTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  credUsername: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6391ff',
    borderColor: '#6391ff',
  },
  checkMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
  },
  qrInstructions: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  cancelQrBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
  },
  cancelQrBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionBtn: {
    backgroundColor: '#6391ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    padding: 20,
  },
  instructionText: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
  camera: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  rescanBtn: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    alignItems: 'center',
  },
  rescanText: {
    color: '#fff',
    fontSize: 16,
  }
});
