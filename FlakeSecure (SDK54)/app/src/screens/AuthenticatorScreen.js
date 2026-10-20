/**
 * ============================================================================
 * FlakeSecure Mobile App - TOTP 2FA Authenticator Screen
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  Vibration,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { AppIcon } from '../components/CategoryIcons';
import {
  getTotpItems,
  saveTotpItem,
  deleteTotpItem,
  getAllCredentials,
} from '../utils/storage';
import { generateTOTP, getRemainingSeconds, parseOtpAuthUri } from '../utils/totp';
import { parseOtpMigrationUri } from '../utils/otpMigration';
import { encryptCredentials } from '../utils/crypto';
import { sendTotp } from '../utils/api';

export default function AuthenticatorScreen({ route, navigation }) {
  const activeRelaySession = route?.params?.relaySession || null;
  const { t } = useLanguage();
  const { colors } = useTheme();

  const [totpList, setTotpList] = useState([]);
  const [allCredentials, setAllCredentials] = useState([]);
  const [tick, setTick] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [issuerInput, setIssuerInput] = useState('');
  const [accountInput, setAccountInput] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [digitsInput, setDigitsInput] = useState(6);
  const [periodInput, setPeriodInput] = useState(30);
  const [algorithmInput, setAlgorithmInput] = useState('SHA1');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [linkedCredId, setLinkedCredId] = useState(null);
  const [linkedDomain, setLinkedDomain] = useState(null);
  const [userTouchedLink, setUserTouchedLink] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('work');

  // Paste link & Clipboard detection inside Add modal
  const [clipboardOtpUri, setClipboardOtpUri] = useState(null);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteUriInput, setPasteUriInput] = useState('');

  // Camera QR Scanner modal state
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerScanned, setScannerScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Google Authenticator Migration batch import modal state
  const [migrationVisible, setMigrationVisible] = useState(false);
  const [migrationItems, setMigrationItems] = useState([]);
  const [migrationSelected, setMigrationSelected] = useState({});
  const [migrationSkippedHotp, setMigrationSkippedHotp] = useState(0);
  const [migrationBatchInfo, setMigrationBatchInfo] = useState({ batchSize: 1, scannedBatches: 1 });

  const loadData = useCallback(async () => {
    try {
      const [items, creds] = await Promise.all([
        getTotpItems(),
        getAllCredentials(),
      ]);
      setTotpList(items);
      setAllCredentials(creds);
    } catch (e) {
      console.log('Failed to load TOTP items', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-suggest credential link when issuer changes on new entry
  useEffect(() => {
    if (editingId || userTouchedLink || !issuerInput.trim() || allCredentials.length === 0) return;
    const cleanIssuer = issuerInput.trim().toLowerCase();
    const match = allCredentials.find((c) => {
      const dom = (c.domain || '').toLowerCase();
      return dom === cleanIssuer || dom.includes(cleanIssuer) || cleanIssuer.includes(dom.replace(/\.[a-z]+$/, ''));
    });
    if (match) {
      setLinkedCredId(match.id);
      setLinkedDomain(match.domain);
    }
  }, [issuerInput, editingId, userTouchedLink, allCredentials]);

  const checkClipboardForOtpUri = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && typeof text === 'string') {
        const trimmed = text.trim();
        if (
          trimmed.toLowerCase().startsWith('otpauth://') ||
          trimmed.toLowerCase().startsWith('otpauth-migration://')
        ) {
          setClipboardOtpUri(trimmed);
          return;
        }
      }
      setClipboardOtpUri(null);
    } catch {
      setClipboardOtpUri(null);
    }
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setIssuerInput('');
    setAccountInput('');
    setSecretInput('');
    setShowSecret(false);
    setDigitsInput(6);
    setPeriodInput(30);
    setAlgorithmInput('SHA1');
    setShowAdvanced(false);
    setNotesInput('');
    setLinkedCredId(null);
    setLinkedDomain(null);
    setUserTouchedLink(false);
    setShowLinkPicker(false);
    setShowPasteBox(false);
    setPasteUriInput('');
  }, []);

  const openAddModal = useCallback(async (prefill = null) => {
    resetForm();
    if (prefill) {
      if (prefill.issuer) setIssuerInput(prefill.issuer);
      if (prefill.accountName || prefill.account) setAccountInput(prefill.accountName || prefill.account);
      if (prefill.secret) setSecretInput(prefill.secret);
      if (prefill.digits === 8) setDigitsInput(8);
      if (prefill.period === 60) setPeriodInput(60);
      if (prefill.algorithm && ['SHA1', 'SHA256', 'SHA512'].includes(prefill.algorithm)) {
        setAlgorithmInput(prefill.algorithm);
      }
      if (prefill.digits === 8 || prefill.period === 60 || (prefill.algorithm && prefill.algorithm !== 'SHA1')) {
        setShowAdvanced(true);
      }
      if (prefill.credId) {
        setLinkedCredId(prefill.credId);
        setLinkedDomain(prefill.domain || null);
        setUserTouchedLink(true);
      }
    }
    await checkClipboardForOtpUri();
    setModalVisible(true);
  }, [resetForm, checkClipboardForOtpUri]);

  const openEditModal = (item) => {
    resetForm();
    setEditingId(item.id);
    setIssuerInput(item.issuer || '');
    setAccountInput(item.account || '');
    setSecretInput(item.secret || '');
    setShowSecret(false);
    setDigitsInput(item.digits === 8 ? 8 : 6);
    setPeriodInput(item.period === 60 ? 60 : 30);
    setAlgorithmInput(['SHA1', 'SHA256', 'SHA512'].includes(item.algorithm) ? item.algorithm : 'SHA1');
    setShowAdvanced(item.digits === 8 || item.period === 60 || (item.algorithm && item.algorithm !== 'SHA1'));
    setNotesInput(item.notes || '');
    setLinkedCredId(item.credId || null);
    setLinkedDomain(item.domain || null);
    setUserTouchedLink(true);
    setSelectedCategory(item.category || 'work');
    setModalVisible(true);
  };

  const handleIncomingOtpUri = useCallback(async (rawUri, appendBatch = false) => {
    if (!rawUri || typeof rawUri !== 'string') {
      Alert.alert(t('error'), t('authenticator.invalidQrUri'));
      return false;
    }
    const uri = rawUri.trim();
    const lower = uri.toLowerCase();

    if (lower.startsWith('otpauth-migration://')) {
      const migration = parseOtpMigrationUri(uri);
      if (!migration || (migration.items.length === 0 && migration.skippedHotpCount === 0)) {
        Alert.alert(t('error'), t('authenticator.invalidMigrationQr'));
        return false;
      }

      const existingSecrets = new Set(
        totpList.map((it) => (it.secret || '').replace(/\s+/g, '').toUpperCase())
      );

      setMigrationItems((prev) => {
        const base = appendBatch ? prev : [];
        const existingInBatch = new Set(base.map((b) => b.secret));
        const merged = [...base];
        for (const item of migration.items) {
          if (!existingInBatch.has(item.secret)) {
            merged.push({
              ...item,
              alreadyExists: existingSecrets.has(item.secret),
            });
          }
        }
        const nextSel = {};
        merged.forEach((m, idx) => {
          nextSel[idx] = !m.alreadyExists;
        });
        setMigrationSelected(nextSel);
        return merged;
      });

      setMigrationSkippedHotp((prev) => (appendBatch ? prev + migration.skippedHotpCount : migration.skippedHotpCount));
      setMigrationBatchInfo((prev) => ({
        batchSize: Math.max(appendBatch ? prev.batchSize : 1, migration.batchSize || 1),
        scannedBatches: appendBatch ? prev.scannedBatches + 1 : 1,
      }));
      setModalVisible(false);
      setScannerVisible(false);
      setMigrationVisible(true);
      return true;
    }

    if (lower.startsWith('otpauth://')) {
      const parsed = parseOtpAuthUri(uri);
      if (!parsed) {
        Alert.alert(t('error'), t('authenticator.invalidQrUri'));
        return false;
      }
      if (parsed.type === 'hotp') {
        Alert.alert(t('error'), t('authenticator.hotpUnsupportedMsg'));
        return false;
      }
      if (!parsed.secret) {
        Alert.alert(t('error'), t('authenticator.invalidSecret'));
        return false;
      }
      setScannerVisible(false);
      await openAddModal({
        issuer: parsed.issuer,
        account: parsed.account,
        secret: parsed.secret,
        digits: parsed.digits,
        period: parsed.period,
        algorithm: parsed.algorithm,
        credId: linkedCredId,
        domain: linkedDomain,
      });
      return true;
    }

    Alert.alert(t('error'), t('authenticator.invalidQrUri'));
    return false;
  }, [totpList, t, openAddModal, linkedCredId, linkedDomain]);

  // Handle route params (`otpauthUri` or `prefillAdd`)
  useEffect(() => {
    if (route?.params?.otpauthUri) {
      const uri = route.params.otpauthUri;
      navigation.setParams({ otpauthUri: undefined });
      handleIncomingOtpUri(uri, false);
    } else if (route?.params?.prefillAdd) {
      const prefill = route.params.prefillAdd;
      navigation.setParams({ prefillAdd: undefined });
      openAddModal(prefill);
    }
  }, [route?.params?.otpauthUri, route?.params?.prefillAdd]);

  const handleScanImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const assetUri = result.assets[0].uri;
      const scanResults = await scanFromURLAsync(assetUri, ['qr']);
      if (!scanResults || scanResults.length === 0) {
        Alert.alert(t('error'), t('authenticator.noOtpQrInImage'));
        return;
      }
      const otpScan = scanResults.find(
        (r) =>
          typeof r?.data === 'string' &&
          (r.data.toLowerCase().startsWith('otpauth://') ||
            r.data.toLowerCase().startsWith('otpauth-migration://'))
      );
      if (!otpScan) {
        Alert.alert(t('error'), t('authenticator.noOtpQrInImage'));
        return;
      }
      await handleIncomingOtpUri(otpScan.data, false);
    } catch (e) {
      Alert.alert(t('error'), t('authenticator.noOtpQrInImage'));
    }
  };

  const handleOpenCameraScanner = async (forNextBatch = false) => {
    if (!permission?.granted) {
      const perm = await requestPermission();
      if (!perm.granted) {
        Alert.alert(t('error'), t('scan.permission'));
        return;
      }
    }
    setScannerScanned(false);
    setScannerVisible(forNextBatch ? 'batch' : 'single');
  };

  const handleCopy = async (item, code) => {
    await Clipboard.setStringAsync(code);
    setCopiedId(item.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);

    setTimeout(async () => {
      try {
        const current = await Clipboard.getStringAsync();
        if (current === code) {
          await Clipboard.setStringAsync('');
        }
      } catch {}
    }, 45000);

    if (activeRelaySession && activeRelaySession.sid && activeRelaySession.keyHex) {
      try {
        const payload = await encryptCredentials(
          { type: 'totp', code, issuer: item.issuer },
          activeRelaySession.keyHex
        );
        await sendTotp(activeRelaySession.sid, payload);
      } catch (err) {
        console.log('Failed to stream TOTP code:', err);
      }
    }
  };

  const handleSave = async () => {
    const cleanSecret = secretInput.replace(/\s/g, '').toUpperCase();
    const cleanIssuer = issuerInput.trim();
    const cleanAccount = accountInput.trim();

    if (!cleanSecret) {
      Alert.alert(t('error'), t('authenticator.invalidSecret'));
      return;
    }

    const testCode = generateTOTP(cleanSecret, periodInput, digitsInput, algorithmInput);
    if (testCode === '------') {
      Alert.alert(t('error'), t('authenticator.invalidSecret'));
      return;
    }

    try {
      await saveTotpItem({
        ...(editingId ? { id: editingId } : {}),
        issuer: cleanIssuer || 'Account',
        account: cleanAccount,
        secret: cleanSecret,
        category: selectedCategory,
        digits: digitsInput,
        period: periodInput,
        algorithm: algorithmInput,
        credId: linkedCredId || null,
        domain: linkedDomain || null,
        notes: notesInput.slice(0, 500),
      });
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (e) {
      Alert.alert(t('error'), 'Failed to save');
    }
  };

  const handleConfirmMigrationImport = async () => {
    const selectedIndices = Object.keys(migrationSelected).filter((idx) => migrationSelected[idx]);
    if (selectedIndices.length === 0) {
      setMigrationVisible(false);
      return;
    }
    try {
      for (const idxStr of selectedIndices) {
        const item = migrationItems[Number(idxStr)];
        if (!item || !item.secret) continue;
        // Auto-link if matching domain exists
        const cleanIss = (item.issuer || '').toLowerCase();
        const matchedCred = allCredentials.find((c) => {
          const dom = (c.domain || '').toLowerCase();
          return dom && cleanIss && (dom === cleanIss || dom.includes(cleanIss));
        });
        await saveTotpItem({
          issuer: item.issuer || 'Account',
          account: item.account || '',
          secret: item.secret,
          digits: item.digits || 6,
          period: item.period || 30,
          algorithm: item.algorithm || 'SHA1',
          credId: matchedCred ? matchedCred.id : null,
          domain: matchedCred ? matchedCred.domain : null,
          category: 'work',
        });
      }
      setMigrationVisible(false);
      setMigrationItems([]);
      await loadData();
      Alert.alert(
        t('success'),
        t('authenticator.migrationImportedMsg', { count: selectedIndices.length })
      );
    } catch (e) {
      Alert.alert(t('error'), e.message || 'Failed to import');
    }
  };

  const handleDelete = (item) => {
    Alert.alert(
      t('authenticator.deleteTitle'),
      t('authenticator.deleteMsg', { name: item.issuer || item.account }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteTotpItem(item.id);
            loadData();
          },
        },
      ]
    );
  };

  const filteredList = totpList.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      (item.issuer || '').toLowerCase().includes(query) ||
      (item.account || '').toLowerCase().includes(query) ||
      (item.domain || '').toLowerCase().includes(query) ||
      (item.notes || '').toLowerCase().includes(query)
    );
  });

  const defaultRemainingSec = getRemainingSeconds(30);
  const defaultUrgent = defaultRemainingSec <= 5;

  const renderItem = ({ item }) => {
    const itemPeriod = item.period === 60 ? 60 : 30;
    const itemDigits = item.digits === 8 ? 8 : 6;
    const itemAlgo = item.algorithm || 'SHA1';
    const code = generateTOTP(item.secret, itemPeriod, itemDigits, itemAlgo);
    const formattedCode =
      code.length === 8
        ? `${code.slice(0, 4)} ${code.slice(4)}`
        : code.length === 6
          ? `${code.slice(0, 3)} ${code.slice(3)}`
          : code;
    const itemRemaining = getRemainingSeconds(itemPeriod);
    const progressPct = (itemRemaining / itemPeriod) * 100;
    const isUrgent = itemRemaining <= 5;
    const isCopied = copiedId === item.id;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={() => handleCopy(item, code)}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
            <Text style={[styles.badgeText, { color: colors.gold }]}>2FA</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.issuerText, { color: colors.textMain }]} numberOfLines={1}>
                {item.issuer || '2FA Code'}
              </Text>
              {item.domain ? (
                <View style={[styles.domainLinkBadge, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <AppIcon name="link" size={10} color={colors.gold} />
                  <Text style={[styles.domainLinkText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.domain}
                  </Text>
                </View>
              ) : null}
            </View>
            {item.account ? (
              <Text style={[styles.accountText, { color: colors.textMuted }]} numberOfLines={1}>
                {item.account}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            style={[styles.iconActionBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppIcon name="edit" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.codeRow}>
          <Text style={[styles.codeText, { color: colors.textMain }, isUrgent && { color: colors.danger }]}>
            {formattedCode}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.itemCountdownText, { color: isUrgent ? colors.danger : colors.textMuted }]}>
              {itemRemaining}s
            </Text>
            <View style={[styles.copyBtn, { backgroundColor: isCopied ? colors.goldBg : colors.inputBg, borderColor: isCopied ? colors.gold : colors.border }]}>
              <Text style={[styles.copyBtnText, { color: isCopied ? colors.gold : colors.textSub }]}>
                {isCopied ? t('authenticator.copied') : t('authenticator.copy')}
              </Text>
            </View>
          </View>
        </View>

        {item.notes ? (
          <View style={styles.notePreviewRow}>
            <AppIcon name="note" size={12} color={colors.textMuted} />
            <Text style={[styles.notePreviewText, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.notes}
            </Text>
          </View>
        ) : null}

        <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPct}%`, backgroundColor: isUrgent ? colors.danger : colors.gold },
            ]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const selectedCredObj = allCredentials.find((c) => c.id === linkedCredId) || null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <AppIcon name="back" size={20} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textMain }]}>{t('authenticator.title')}</Text>
        <TouchableOpacity
          onPress={() => openAddModal()}
          style={[styles.addHeaderBtn, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
        >
          <Text style={[styles.addHeaderBtnText, { color: colors.gold }]}>{t('home.addButton')}</Text>
        </TouchableOpacity>
      </View>

      {activeRelaySession && (
        <View style={[styles.streamingBanner, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
          <AppIcon name="alert" size={16} color={colors.gold} style={{ marginRight: 8 }} />
          <Text style={[styles.streamingText, { color: colors.gold }]}>
            {t('authenticator.streamingBanner', { domain: activeRelaySession.domain || 'Browser' })}
          </Text>
        </View>
      )}

      <View style={styles.timerBar}>
        <Text style={[styles.timerLabel, { color: colors.textMuted }]}>{t('authenticator.nextCodeIn')}</Text>
        <Text style={[styles.timerValue, { color: colors.gold }, defaultUrgent && { color: colors.danger }]}>
          {defaultRemainingSec}s
        </Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
          placeholder={t('authenticator.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={tick}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AppIcon name="totp" size={44} color={colors.gold} style={{ marginBottom: 14 }} />
            <Text style={[styles.emptyTitle, { color: colors.textMain }]}>{t('authenticator.emptyTitle')}</Text>
            <Text style={[styles.emptySub, { color: colors.textSub }]}>
              {t('authenticator.emptySub')}
            </Text>
            <TouchableOpacity
              style={[styles.addEmptyBtn, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
              onPress={() => openAddModal()}
            >
              <Text style={[styles.addEmptyBtnText, { color: colors.gold }]}>{t('authenticator.addAccount')}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add / Edit TOTP Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.85)' }]}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.modalCard || (colors.isDark ? '#0c101b' : '#ffffff'), borderColor: colors.border }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: colors.textMain }]}>
                {editingId ? t('authenticator.editAccountTitle') : t('authenticator.newAccountTitle')}
              </Text>

              {/* Quick Import Bar (only when creating a new entry) */}
              {!editingId && (
                <>
                  <View style={styles.importMethodsRow}>
                    <TouchableOpacity
                      style={[styles.importMethodBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                      onPress={() => handleOpenCameraScanner(false)}
                    >
                      <AppIcon name="qr" size={16} color={colors.gold} />
                      <Text style={[styles.importMethodText, { color: colors.textMain }]} numberOfLines={1}>
                        {t('authenticator.scanQrBtn')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.importMethodBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                      onPress={handleScanImage}
                    >
                      <AppIcon name="image" size={16} color={colors.gold} />
                      <Text style={[styles.importMethodText, { color: colors.textMain }]} numberOfLines={1}>
                        {t('authenticator.fromImageBtn')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.importMethodBtn,
                        { backgroundColor: showPasteBox ? colors.goldBg : colors.inputBg, borderColor: showPasteBox ? colors.gold : colors.border },
                      ]}
                      onPress={() => setShowPasteBox(!showPasteBox)}
                    >
                      <AppIcon name="clipboard" size={16} color={colors.gold} />
                      <Text style={[styles.importMethodText, { color: colors.textMain }]} numberOfLines={1}>
                        {t('authenticator.pasteLinkBtn')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {clipboardOtpUri && (
                    <TouchableOpacity
                      style={[styles.clipboardBanner, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
                      onPress={() => handleIncomingOtpUri(clipboardOtpUri, false)}
                    >
                      <AppIcon name="clipboard" size={15} color={colors.gold} />
                      <Text style={[styles.clipboardBannerText, { color: colors.gold }]} numberOfLines={1}>
                        {t('authenticator.useCopiedLinkBtn')}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {showPasteBox && (
                    <View style={[styles.pasteBoxContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                      <TextInput
                        style={[styles.pasteInput, { color: colors.textMain }]}
                        placeholder="otpauth://totp/..."
                        placeholderTextColor={colors.textMuted}
                        value={pasteUriInput}
                        onChangeText={setPasteUriInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={[styles.parseBtn, { backgroundColor: colors.gold }]}
                        onPress={() => handleIncomingOtpUri(pasteUriInput, false)}
                      >
                        <Text style={styles.parseBtnText}>{t('authenticator.parseUriBtn')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('authenticator.issuer')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                placeholder={t('authenticator.issuerPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={issuerInput}
                onChangeText={setIssuerInput}
              />

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('authenticator.account')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                placeholder={t('authenticator.accountPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={accountInput}
                onChangeText={setAccountInput}
                autoCapitalize="none"
              />

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('authenticator.secret')}</Text>
              <View style={styles.secretRow}>
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                  placeholder={t('authenticator.secretPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={secretInput}
                  onChangeText={setSecretInput}
                  autoCapitalize="characters"
                  secureTextEntry={!showSecret}
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.secretEyeBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  onPress={() => setShowSecret(!showSecret)}
                >
                  <AppIcon name={showSecret ? 'eyeOff' : 'eye'} size={18} color={colors.gold} />
                </TouchableOpacity>
              </View>

              {/* Link to Stored Credential */}
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('authenticator.linkToLoginLabel')}</Text>
              <TouchableOpacity
                style={[styles.linkSelectorBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                onPress={() => setShowLinkPicker(!showLinkPicker)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <AppIcon name="link" size={15} color={linkedCredId ? colors.gold : colors.textMuted} />
                  <Text style={[styles.linkSelectorText, { color: linkedCredId ? colors.textMain : colors.textMuted }]} numberOfLines={1}>
                    {selectedCredObj
                      ? `${selectedCredObj.domain} (${selectedCredObj.name || selectedCredObj.username})`
                      : linkedDomain
                        ? linkedDomain
                        : t('authenticator.linkNone')}
                  </Text>
                </View>
                <AppIcon name={showLinkPicker ? 'chevronUp' : 'chevronDown'} size={14} color={colors.textMuted} />
              </TouchableOpacity>

              {showLinkPicker && (
                <View style={[styles.linkPickerList, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[
                      styles.linkPickerOption,
                      !linkedCredId && { backgroundColor: colors.goldBg },
                    ]}
                    onPress={() => {
                      setLinkedCredId(null);
                      setLinkedDomain(null);
                      setUserTouchedLink(true);
                      setShowLinkPicker(false);
                    }}
                  >
                    <Text style={[styles.linkPickerOptionText, { color: !linkedCredId ? colors.gold : colors.textSecondary }]}>
                      {t('authenticator.linkNone')}
                    </Text>
                  </TouchableOpacity>
                  {allCredentials.map((cred) => {
                    const isSel = linkedCredId === cred.id;
                    return (
                      <TouchableOpacity
                        key={cred.id}
                        style={[
                          styles.linkPickerOption,
                          isSel && { backgroundColor: colors.goldBg },
                        ]}
                        onPress={() => {
                          setLinkedCredId(cred.id);
                          setLinkedDomain(cred.domain);
                          setUserTouchedLink(true);
                          setShowLinkPicker(false);
                        }}
                      >
                        <Text style={[styles.linkPickerOptionText, { color: isSel ? colors.gold : colors.textMain }]} numberOfLines={1}>
                          {cred.domain} — {cred.name || cred.username}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Notes field (max 500 chars) */}
              <View style={styles.notesHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMuted, marginBottom: 0 }]}>{t('authenticator.notesLabel')}</Text>
                <Text style={[styles.charCounter, { color: notesInput.length >= 500 ? colors.warning : colors.textMuted }]}>
                  {notesInput.length}/500
                </Text>
              </View>
              <TextInput
                style={[styles.input, styles.notesInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                placeholder={t('authenticator.notesPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={notesInput}
                onChangeText={(val) => setNotesInput(val.slice(0, 500))}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />

              {/* Collapsible Advanced Options (Digits, Period, Algorithm) */}
              <TouchableOpacity
                style={styles.advancedToggleRow}
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <Text style={[styles.advancedToggleText, { color: colors.gold }]}>
                  {t('authenticator.advancedOptions')}
                </Text>
                <AppIcon name={showAdvanced ? 'chevronUp' : 'chevronDown'} size={14} color={colors.gold} />
              </TouchableOpacity>

              {showAdvanced && (
                <View style={[styles.advancedBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <View style={styles.advancedRow}>
                    <Text style={[styles.advancedLabel, { color: colors.textSecondary }]}>{t('authenticator.digitsLabel')}</Text>
                    <View style={styles.pillGroup}>
                      {[6, 8].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[
                            styles.pillOption,
                            { borderColor: colors.border },
                            digitsInput === d && { backgroundColor: colors.goldBg, borderColor: colors.gold },
                          ]}
                          onPress={() => setDigitsInput(d)}
                        >
                          <Text style={[styles.pillText, { color: digitsInput === d ? colors.gold : colors.textSecondary }]}>
                            {d}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.advancedRow}>
                    <Text style={[styles.advancedLabel, { color: colors.textSecondary }]}>{t('authenticator.periodLabel')}</Text>
                    <View style={styles.pillGroup}>
                      {[30, 60].map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={[
                            styles.pillOption,
                            { borderColor: colors.border },
                            periodInput === p && { backgroundColor: colors.goldBg, borderColor: colors.gold },
                          ]}
                          onPress={() => setPeriodInput(p)}
                        >
                          <Text style={[styles.pillText, { color: periodInput === p ? colors.gold : colors.textSecondary }]}>
                            {p}s
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.advancedRow}>
                    <Text style={[styles.advancedLabel, { color: colors.textSecondary }]}>{t('authenticator.algorithmLabel')}</Text>
                    <View style={styles.pillGroup}>
                      {['SHA1', 'SHA256', 'SHA512'].map((alg) => (
                        <TouchableOpacity
                          key={alg}
                          style={[
                            styles.pillOption,
                            { borderColor: colors.border },
                            algorithmInput === alg && { backgroundColor: colors.goldBg, borderColor: colors.gold },
                          ]}
                          onPress={() => setAlgorithmInput(alg)}
                        >
                          <Text style={[styles.pillText, { color: algorithmInput === alg ? colors.gold : colors.textSecondary }]}>
                            {alg}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <LinearGradient
                    colors={colors.goldGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBtn}
                  >
                    <Text style={styles.saveBtnText}>{t('save')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* In-App Camera QR Scanner Modal */}
      <Modal
        visible={!!scannerVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setScannerVisible(false)}
      >
        <SafeAreaView style={[styles.scannerContainer, { backgroundColor: '#000' }]}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity onPress={() => setScannerVisible(false)} style={styles.scannerCloseBtn}>
              <AppIcon name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>{t('authenticator.scanQrTitle')}</Text>
            <View style={{ width: 32 }} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={
                scannerScanned
                  ? undefined
                  : ({ data }) => {
                      if (!data) return;
                      setScannerScanned(true);
                      Vibration.vibrate(80);
                      const isBatch = scannerVisible === 'batch';
                      handleIncomingOtpUri(data, isBatch).then((ok) => {
                        if (!ok) setScannerScanned(false);
                      });
                    }
              }
            />
            <View style={[styles.scannerFrame, { borderColor: colors.gold }]} pointerEvents="none" />
          </View>
          <View style={styles.scannerFooter}>
            <Text style={styles.scannerHint}>{t('authenticator.scanQrHint')}</Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Google Authenticator Migration Multi-Select Modal */}
      <Modal
        visible={migrationVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMigrationVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.85)' }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.modalCard || (colors.isDark ? '#0c101b' : '#ffffff'), borderColor: colors.border, maxHeight: '85%' }]}>
            <Text style={[styles.modalTitle, { color: colors.textMain }]}>
              {t('authenticator.migrationTitle')}
            </Text>

            {migrationBatchInfo.batchSize > 1 && (
              <View style={[styles.migrationInfoBanner, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
                <Text style={[styles.migrationInfoText, { color: colors.gold }]}>
                  {t('authenticator.migrationBatchInfo', {
                    current: migrationBatchInfo.scannedBatches,
                    total: migrationBatchInfo.batchSize,
                  })}
                </Text>
                {migrationBatchInfo.scannedBatches < migrationBatchInfo.batchSize && (
                  <TouchableOpacity
                    style={[styles.scanNextBatchBtn, { backgroundColor: colors.gold }]}
                    onPress={() => handleOpenCameraScanner(true)}
                  >
                    <AppIcon name="qr" size={14} color="#ffffff" />
                    <Text style={styles.scanNextBatchText}>{t('authenticator.scanNextBatchBtn')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {migrationSkippedHotp > 0 && (
              <View style={[styles.migrationInfoBanner, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.migrationInfoText, { color: colors.textSecondary }]}>
                  {t('authenticator.migrationSkippedHotp', { count: migrationSkippedHotp })}
                </Text>
              </View>
            )}

            <ScrollView style={{ maxHeight: 320, marginVertical: 8 }}>
              {migrationItems.map((mItem, idx) => {
                const checked = !!migrationSelected[idx];
                return (
                  <TouchableOpacity
                    key={`${mItem.secret}-${idx}`}
                    style={[
                      styles.migrationRow,
                      { backgroundColor: colors.inputBg, borderColor: checked ? colors.gold : colors.border },
                    ]}
                    onPress={() =>
                      setMigrationSelected((prev) => ({ ...prev, [idx]: !prev[idx] }))
                    }
                  >
                    <View
                      style={[
                        styles.migrationCheck,
                        { borderColor: checked ? colors.gold : colors.border, backgroundColor: checked ? colors.gold : 'transparent' },
                      ]}
                    >
                      {checked && <AppIcon name="check" size={12} color="#ffffff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.migrationIssuer, { color: colors.textMain }]} numberOfLines={1}>
                        {mItem.issuer}
                      </Text>
                      <Text style={[styles.migrationAccount, { color: colors.textMuted }]} numberOfLines={1}>
                        {mItem.account} · {mItem.algorithm} · {mItem.digits}d
                      </Text>
                    </View>
                    {mItem.alreadyExists && (
                      <Text style={[styles.migrationExistsTag, { color: colors.warning }]}>
                        {t('authenticator.alreadyExists')}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                onPress={() => {
                  setMigrationVisible(false);
                  setMigrationItems([]);
                }}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleConfirmMigrationImport}>
                <LinearGradient
                  colors={colors.goldGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtn}
                >
                  <Text style={styles.saveBtnText}>{t('authenticator.importSelectedBtn')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  addHeaderBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addHeaderBtnText: { fontSize: 13, fontWeight: '700' },
  streamingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
  },
  streamingText: { fontSize: 12, fontWeight: '600', flex: 1 },
  timerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  timerLabel: { fontSize: 12, fontWeight: '600' },
  timerValue: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  searchBox: { paddingHorizontal: 20, marginBottom: 10 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 30 },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  issuerText: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  accountText: { fontSize: 12, marginTop: 2 },
  domainLinkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 130,
  },
  domainLinkText: { fontSize: 10, fontWeight: '600' },
  iconActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  itemCountdownText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  copyBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  copyBtnText: { fontSize: 12, fontWeight: '700' },
  notePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  notePreviewText: { fontSize: 12, flex: 1 },
  progressBarBg: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%' },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  addEmptyBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  addEmptyBtnText: { fontSize: 14, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
  importMethodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  importMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  importMethodText: { fontSize: 11, fontWeight: '700' },
  clipboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  clipboardBannerText: { fontSize: 12, fontWeight: '700', flex: 1 },
  pasteBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
    marginBottom: 10,
  },
  pasteInput: { flex: 1, fontSize: 13, paddingHorizontal: 8, paddingVertical: 6 },
  parseBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  parseBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  secretRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  secretEyeBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  linkSelectorText: { fontSize: 13, fontWeight: '600' },
  linkPickerList: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 6,
    maxHeight: 150,
    overflow: 'hidden',
  },
  linkPickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkPickerOptionText: { fontSize: 13, fontWeight: '600' },
  notesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  charCounter: { fontSize: 11, fontWeight: '600' },
  notesInput: { minHeight: 68, paddingTop: 10 },
  advancedToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 6,
  },
  advancedToggleText: { fontSize: 12, fontWeight: '700' },
  advancedBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
    marginTop: 4,
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  advancedLabel: { fontSize: 12, fontWeight: '600' },
  pillGroup: { flexDirection: 'row', gap: 6 },
  pillOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { flex: 1 },
  gradientBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  scannerContainer: { flex: 1 },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scannerCloseBtn: { padding: 6 },
  scannerTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  scannerFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderRadius: 8,
  },
  scannerFooter: { padding: 24, alignItems: 'center' },
  scannerHint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' },
  migrationInfoBanner: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  migrationInfoText: { fontSize: 12, fontWeight: '600' },
  scanNextBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
  },
  scanNextBatchText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  migrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  migrationCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  migrationIssuer: { fontSize: 14, fontWeight: '700' },
  migrationAccount: { fontSize: 12, marginTop: 2 },
  migrationExistsTag: { fontSize: 11, fontWeight: '700' },
});
