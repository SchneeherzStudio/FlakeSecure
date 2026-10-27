/**
 * ============================================================================
 * FlakeSecure Mobile App - Credential & Code Sharing / Device Import
 * (ShareImportScreen) v2.1.0
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';

import {
  getAllCredentials,
  saveCredentials,
  getCredentialsForDomain,
  getNote,
  getCodes,
  saveCode,
  CODE_CATEGORIES,
} from '../utils/storage';
import FaviconImage from '../components/FaviconImage';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { encryptCredentials, decryptCredentials, bytesToHex } from '../utils/crypto';
import * as ExpoCrypto from 'expo-crypto';
import { getServerUrl } from '../utils/api';
import { AppIcon, CategoryIcon } from '../components/CategoryIcons';

export default function ShareImportScreen({ route, navigation }) {
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();
  const { mode } = route.params || { mode: 'import' };
  const preselectCodeId = route.params?.preselectCodeId || null;
  const { isOfflineMode } = useAuth();
  const toast = useToast();

  const [credentials, setCredentials] = useState([]);
  const [codes, setCodes] = useState([]);
  const [selectedCreds, setSelectedCreds] = useState({});
  const [selectedCodes, setSelectedCodes] = useState({});
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [activeSid, setActiveSid] = useState(null);

  const [recipient, setRecipient] = useState('');
  const [hideFromRecipient, setHideFromRecipient] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState(null);
  const [includeNotes, setIncludeNotes] = useState(mode === 'export');

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    setIncludeNotes(mode === 'export');
    if (mode === 'export' || mode === 'share') {
      loadShareableItems();
    }
    if (route.params?.sid && route.params?.key) {
      processImportPayload(route.params.sid, route.params.key);
    }
  }, [mode, route.params]);

  useEffect(() => {
    if (preselectCodeId) {
      setSelectedCodes((prev) => ({ ...prev, [preselectCodeId]: true }));
    }
  }, [preselectCodeId]);

  useEffect(() => {
    if (!activeSid || !qrData) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const serverUrl = await getServerUrl();
        const res = await fetch(`${serverUrl}/api/share/status/${activeSid}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'consumed') {
          clearInterval(interval);
          if (isMounted) {
            setQrData(null);
            setActiveSid(null);
            toast.success(
              t('success'),
              mode === 'share' ? t('share.shareSuccessAlert') : t('share.exportSuccessAlert')
            );
            setTimeout(() => navigation.goBack(), 900);
          }
        } else if (data.status === 'expired') {
          clearInterval(interval);
          if (isMounted) {
            setQrData(null);
            setActiveSid(null);
            toast.error(t('error'), t('share.exportFailedAlert'));
          }
        }
      } catch (err) {}
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeSid, qrData, mode, navigation]);

  const loadShareableItems = async () => {
    try {
      setLoading(true);
      const [creds, storedCodes] = await Promise.all([
        getAllCredentials(),
        getCodes(),
      ]);
      setCredentials(creds || []);
      setCodes(storedCodes || []);
    } catch (error) {
      toast.error(t('error'), 'Failed to load vault items');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (key) => {
    setSelectedCreds((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleCodeSelection = (id) => {
    setSelectedCodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const selectAll = () => {
    const allCredsSelected =
      credentials.length === 0 || credentials.every((c) => selectedCreds[c.id || c.domain]);
    const allCodesSelected =
      codes.length === 0 || codes.every((c) => selectedCodes[c.id]);
    const allSelected = allCredsSelected && allCodesSelected;

    const newSelectedCreds = {};
    const newSelectedCodes = {};
    if (!allSelected) {
      credentials.forEach((c) => {
        newSelectedCreds[c.id || c.domain] = true;
      });
      codes.forEach((c) => {
        newSelectedCodes[c.id] = true;
      });
    }
    setSelectedCreds(newSelectedCreds);
    setSelectedCodes(newSelectedCodes);
  };

  const handleGenerateQR = async () => {
    if (isOfflineMode) {
      toast.warn(t('offline.actionRequiresOnlineTitle'), t('offline.shareRequiresOnline'));
      return;
    }

    const selectedCredKeys = Object.keys(selectedCreds).filter((k) => selectedCreds[k]);
    const selectedCodeIds = Object.keys(selectedCodes).filter((k) => selectedCodes[k]);

    if (selectedCredKeys.length === 0 && selectedCodeIds.length === 0) {
      toast.warn(t('error'), t('share.selectAtLeastOne'));
      return;
    }

    if (mode === 'share' && !recipient.trim()) {
      toast.warn(t('error'), t('share.enterRecipient'));
      return;
    }

    try {
      setLoading(true);
      const itemsToExport = [];

      for (const key of selectedCredKeys) {
        const item = credentials.find((c) => c.id === key || c.domain === key);
        if (item) {
          const accounts = await getCredentialsForDomain(item.domain);
          const fullCred = (item.id ? accounts.find((a) => a.id === item.id) : null) || accounts[0];
          if (fullCred) {
            const noteText = includeNotes && fullCred.id ? await getNote(fullCred.id) : '';
            itemsToExport.push({
              itemType: 'login',
              domain: item.domain,
              name: fullCred.name || '',
              username: fullCred.username,
              password: fullCred.password,
              ...(includeNotes && noteText ? { notes: noteText } : {}),
            });
          }
        }
      }

      for (const codeId of selectedCodeIds) {
        const codeObj = codes.find((c) => c.id === codeId);
        if (codeObj) {
          itemsToExport.push({
            itemType: 'code',
            label: codeObj.label,
            codeValue: codeObj.codeValue,
            category: codeObj.category || 'door',
            location: codeObj.location || '',
            ...(includeNotes && codeObj.notes ? { notes: codeObj.notes } : {}),
          });
        }
      }

      const randomKey = await ExpoCrypto.getRandomBytesAsync(32);
      const keyHex = bytesToHex(randomKey);

      const randomSid = await ExpoCrypto.getRandomBytesAsync(16);
      const sid = bytesToHex(randomSid);

      const encrypted = await encryptCredentials(itemsToExport, keyHex);

      const serverUrl = await getServerUrl();
      const response = await fetch(`${serverUrl}/api/share/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sid,
          payload: encrypted,
          recipient: mode === 'share' ? recipient.trim().toLowerCase() : undefined,
          hidden: mode === 'share' ? hideFromRecipient : false,
          expiresInHours: mode === 'share' ? expiresInHours : null,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to initialize share session');
      }

      const qrPayload = `flakesecure://share?sid=${sid}&key=${keyHex}`;
      setQrData(qrPayload);
      setActiveSid(sid);
    } catch (error) {
      toast.error(t('error'), error.message || 'Failed to create share package');
    } finally {
      setLoading(false);
    }
  };

  const processImportPayload = async (sid, keyHex) => {
    if (isOfflineMode) {
      toast.warn(t('offline.actionRequiresOnlineTitle'), t('offline.shareRequiresOnline'));
      return;
    }

    try {
      setLoading(true);
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
      const decryptedJson = await decryptCredentials(payloadRaw, keyHex);
      let itemsToImport = JSON.parse(decryptedJson);

      if (typeof itemsToImport === 'string') {
        itemsToImport = JSON.parse(itemsToImport);
      }
      if (!Array.isArray(itemsToImport)) {
        itemsToImport = [itemsToImport];
      }

      let savedCount = 0;

      for (const item of itemsToImport) {
        if (!item) continue;
        if (item.itemType === 'code' || (item.codeValue && item.label)) {
          await saveCode({
            label: item.label || 'Code',
            codeValue: item.codeValue || '',
            category: item.category || 'door',
            location: item.location || '',
            notes: item.notes || '',
          });
          savedCount++;
        } else if (item.domain && item.username) {
          await saveCredentials(item.domain, item.username, item.password || '', {
            name: item.name || '',
            ...(item.notes !== undefined ? { notes: item.notes } : {}),
            ...(hidden && { hidden: true }),
            ...(expiresInHours && { expiresAt: new Date(Date.now() + expiresInHours * 3600000).toISOString() }),
            sharedBy: 'shared',
          });
          savedCount++;
        }
      }

      toast.success(t('success'), `Successfully imported ${savedCount} item${savedCount === 1 ? '' : 's'}.`);
      setTimeout(() => navigation.navigate('Home'), 1200);
    } catch (error) {
      toast.error(t('error'), error.message || 'Failed to process import data');
    } finally {
      setLoading(false);
      setScanned(false);
    }
  };

  const handleBarCodeScanned = async ({ data }) => {
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
        toast.warn(t('error'), 'This QR code is not valid for FlakeSecure imports.');
        setScanned(false);
      }
    } catch (error) {
      toast.error(t('error'), error.message || 'Failed to process QR code');
      setScanned(false);
    }
  };

  const renderExportShare = () => (
    <View style={styles.content}>
      {mode === 'share' && (
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Recipient Username</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.textMain }]}
            placeholder="Enter username"
            placeholderTextColor={colors.textMuted}
            value={recipient}
            onChangeText={(text) => setRecipient(text.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      <View style={[styles.shareOptions, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        {mode === 'share' && (
          <>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setHideFromRecipient(!hideFromRecipient)}
            >
              <View
                style={[
                  styles.optionCheck,
                  { borderColor: colors.border, backgroundColor: colors.inputBg },
                  hideFromRecipient && { backgroundColor: colors.gold, borderColor: colors.gold },
                ]}
              >
                {hideFromRecipient && <AppIcon name="check" size={12} color="#ffffff" />}
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionLabel, { color: colors.textMain }]}>{t('share.hideFromRecipientLabel')}</Text>
                <Text style={[styles.optionDesc, { color: colors.textMuted }]}>{t('share.hideFromRecipientDesc')}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.optionRow}>
              <Text style={[styles.optionLabel, { color: colors.textMain }]}>{t('share.autoDeleteAfter')}</Text>
              <View style={styles.expiryBtns}>
                {[null, 1, 24, 168, 720].map((hours) => (
                  <TouchableOpacity
                    key={hours ?? 'never'}
                    style={[
                      styles.expiryBtn,
                      { backgroundColor: colors.inputBg },
                      expiresInHours === hours && { backgroundColor: colors.gold },
                    ]}
                    onPress={() => setExpiresInHours(hours)}
                  >
                    <Text
                      style={[
                        styles.expiryBtnText,
                        { color: colors.textMuted },
                        expiresInHours === hours && { color: '#ffffff', fontWeight: '800' },
                      ]}
                    >
                      {hours === null ? t('share.expiryNever') : hours === 1 ? '1h' : hours === 24 ? '1d' : hours === 168 ? '7d' : '30d'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => setIncludeNotes(!includeNotes)}
        >
          <View
            style={[
              styles.optionCheck,
              { borderColor: colors.border, backgroundColor: colors.inputBg },
              includeNotes && { backgroundColor: colors.gold, borderColor: colors.gold },
            ]}
          >
            {includeNotes && <AppIcon name="check" size={12} color="#ffffff" />}
          </View>
          <View style={styles.optionInfo}>
            <Text style={[styles.optionLabel, { color: colors.textMain }]}>{t('share.includeNotesLabel')}</Text>
            <Text style={[styles.optionDesc, { color: colors.textMuted }]}>{t('share.includeNotesDesc')}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.listHeader}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          Select Logins & Codes to {mode === 'share' ? 'Share' : 'Export'}
        </Text>
        <TouchableOpacity onPress={selectAll}>
          <Text style={[styles.selectAllText, { color: colors.gold }]}>Toggle All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {credentials.map((cred) => {
          const itemKey = cred.id || cred.domain;
          const isSelected = !!selectedCreds[itemKey];
          const displayName = cred.name
            ? cred.name
            : cred.hidden
            ? t('credentials.sharedAccount')
            : cred.username;
          const showUsername = cred.name && !cred.hidden;

          return (
            <TouchableOpacity
              key={itemKey}
              style={[
                styles.credItem,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
                isSelected && { borderColor: colors.gold, backgroundColor: colors.goldBg },
              ]}
              onPress={() => toggleSelection(itemKey)}
            >
              <FaviconImage domain={cred.domain} size={36} borderRadius={6} style={{ marginRight: 12 }} />
              <View style={styles.credInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.credTitle, { color: colors.textMain }]}>{cred.domain}</Text>
                  {cred.hidden && <AppIcon name="lock" size={11} color={colors.gold} />}
                </View>
                <Text style={[styles.credUsername, { color: colors.textMuted }]}>{displayName}</Text>
                {showUsername && (
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>{cred.username}</Text>
                )}
              </View>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: colors.isDark ? '#ffffff' : '#94a3b8', backgroundColor: colors.inputBg },
                  isSelected && { backgroundColor: colors.gold, borderColor: colors.gold },
                ]}
              >
                {isSelected && <AppIcon name="check" size={12} color="#ffffff" />}
              </View>
            </TouchableOpacity>
          );
        })}

        {codes.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.label, { color: colors.textMuted, marginBottom: 8 }]}>
              {t('home.segmentCodes')} ({codes.length})
            </Text>
            {codes.map((codeItem) => {
              const isSelected = !!selectedCodes[codeItem.id];
              const catDef =
                CODE_CATEGORIES.find(
                  (c) => c.id === (codeItem.codeCategory || codeItem.category)
                ) || CODE_CATEGORIES[0];
              return (
                <TouchableOpacity
                  key={codeItem.id}
                  style={[
                    styles.credItem,
                    { backgroundColor: colors.cardBg, borderColor: colors.border },
                    isSelected && { borderColor: colors.gold, backgroundColor: colors.goldBg },
                  ]}
                  onPress={() => toggleCodeSelection(codeItem.id)}
                >
                  <View
                    style={[
                      styles.codeIconBox,
                      { backgroundColor: colors.goldBg, borderColor: colors.goldBorder },
                    ]}
                  >
                    <CategoryIcon name={catDef.icon} size={18} color={colors.gold} />
                  </View>
                  <View style={styles.credInfo}>
                    <Text style={[styles.credTitle, { color: colors.textMain }]}>{codeItem.label}</Text>
                    <Text style={[styles.credUsername, { color: colors.textMuted }]}>
                      {t(catDef.labelKey)}
                      {codeItem.location ? ` • ${codeItem.location}` : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: colors.isDark ? '#ffffff' : '#94a3b8', backgroundColor: colors.inputBg },
                      isSelected && { backgroundColor: colors.gold, borderColor: colors.gold },
                    ]}
                  >
                    {isSelected && <AppIcon name="check" size={12} color="#ffffff" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {qrData ? (
        <View style={[styles.qrContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <QRCode value={qrData} size={200} backgroundColor="transparent" color={isDark ? '#ffffff' : '#07090e'} />
          <Text style={[styles.qrInstructions, { color: colors.textMuted }]}>
            {mode === 'share' ? t('share.shareWaitingInstruction') : t('share.exportWaitingInstruction')}
          </Text>
          <TouchableOpacity
            style={[styles.cancelQrBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
            onPress={async () => {
              if (activeSid) {
                const serverUrl = await getServerUrl();
                await fetch(`${serverUrl}/api/share/cancel/${activeSid}`, { method: 'DELETE' }).catch(() => {});
              }
              setQrData(null);
              setActiveSid(null);
            }}
          >
            <Text style={[styles.cancelQrBtnText, { color: colors.textSub }]}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={handleGenerateQR} disabled={loading} style={styles.actionBtnContainer}>
          <LinearGradient colors={colors.goldGradient} style={styles.actionBtn}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.actionBtnText}>{t('share.showQr')}</Text>}
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderImport = () => {
    if (!permission) return <View style={[styles.container, { backgroundColor: colors.bg }]} />;
    if (!permission.granted) {
      return (
        <View style={[styles.centerContent, { backgroundColor: colors.bg }]}>
          <Text style={[styles.text, { color: colors.textMain }]}>We need your permission to show the camera</Text>
          <TouchableOpacity onPress={requestPermission} style={[styles.permissionBtn, { backgroundColor: colors.gold }]}>
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.cameraContainer, { backgroundColor: colors.bg }]}>
        <Text style={[styles.instructionText, { color: colors.textMain }]}>Scan the QR code shown on your other device</Text>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
        {scanned && (
          <TouchableOpacity style={[styles.rescanBtn, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]} onPress={() => setScanned(false)}>
            <Text style={[styles.rescanText, { color: colors.gold }]}>Tap to Scan Again</Text>
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <AppIcon name="back" size={20} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textMain }]}>{getTitle()}</Text>
      </View>

      {mode === 'export' || mode === 'share' ? renderExportShare() : renderImport()}
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
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  label: {
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  shareOptions: {
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  expiryBtns: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 'auto',
  },
  expiryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  expiryBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    marginBottom: 16,
  },
  credItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  codeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  credInfo: {
    flex: 1,
  },
  credTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  credUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionBtn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderWidth: 1,
    borderRadius: 8,
  },
  qrInstructions: {
    marginTop: 16,
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 13,
  },
  cancelQrBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  cancelQrBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 15,
  },
  permissionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  cameraContainer: {
    flex: 1,
    padding: 20,
  },
  instructionText: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 15,
  },
  camera: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rescanBtn: {
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  rescanText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
