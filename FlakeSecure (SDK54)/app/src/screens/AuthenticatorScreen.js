/**
 * ============================================================================
 * FlakeSecure Mobile App - TOTP 2FA Authenticator Screen
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. TOTP CODE LIFECYCLE & ROTATION:
 *    - Automatically calculates 6-digit codes and countdown timer (0-30s) every second.
 *    - copyCode(item): Copies current TOTP code to clipboard with instant feedback.
 * 
 * 2. ACCOUNT MANAGEMENT (ADD / DELETE):
 *    - handleAddAccount(): Validates Base32 secret, issuer, and saves to SecureStore.
 *    - handleDeleteAccount(id): Confirmation dialog and removal of TOTP secret.
 * 
 * 3. RELAY STREAMING:
 *    - handleStreamToSession(sid, item): Encrypts TOTP code with session AES key and transmits via /send-totp.
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useLanguage } from '../context/LanguageContext';
import { getTotpItems, saveTotpItem, deleteTotpItem } from '../utils/storage';
import { generateTOTP, getRemainingSeconds, parseOtpAuthUri } from '../utils/totp';
import { encryptCredentials } from '../utils/crypto';
import { sendTotp } from '../utils/api';

export default function AuthenticatorScreen({ route, navigation }) {
  const activeRelaySession = route?.params?.relaySession || null;
  const { t } = useLanguage();

  const [totpList, setTotpList] = useState([]);
  const [remainingSec, setRemainingSec] = useState(getRemainingSeconds());
  const [copiedId, setCopiedId] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [issuerInput, setIssuerInput] = useState('');
  const [accountInput, setAccountInput] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('work');

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTotpItems();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const sec = getRemainingSeconds();
      setRemainingSec(sec);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadTotpItems = async () => {
    try {
      const items = await getTotpItems();
      setTotpList(items);
    } catch (e) {
      console.log('Failed to load TOTP items', e);
    }
  };

  const handleCopy = async (item, code) => {
    await Clipboard.setStringAsync(code);
    setCopiedId(item.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);

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

  const handleAdd = async () => {
    const cleanSecret = secretInput.replace(/\s/g, '').toUpperCase();
    const cleanIssuer = issuerInput.trim();
    const cleanAccount = accountInput.trim();

    if (!cleanSecret) {
      Alert.alert(t('error'), t('authenticator.invalidSecret'));
      return;
    }

    const testCode = generateTOTP(cleanSecret);
    if (testCode === '------') {
      Alert.alert(t('error'), t('authenticator.invalidSecret'));
      return;
    }

    try {
      await saveTotpItem({
        issuer: cleanIssuer || 'Account',
        account: cleanAccount,
        secret: cleanSecret,
        category: selectedCategory,
      });
      setModalVisible(false);
      setIssuerInput('');
      setAccountInput('');
      setSecretInput('');
      loadTotpItems();
    } catch (e) {
      Alert.alert(t('error'), 'Failed to save');
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
            loadTotpItems();
          },
        },
      ]
    );
  };

  const filteredList = totpList.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      (item.issuer || '').toLowerCase().includes(query) ||
      (item.account || '').toLowerCase().includes(query)
    );
  });

  const progressPct = (remainingSec / 30) * 100;
  const isUrgent = remainingSec <= 5;

  const renderItem = ({ item }) => {
    const code = generateTOTP(item.secret);
    const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
    const isCopied = copiedId === item.id;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => handleCopy(item, code)}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>2FA</Text>
          </View>
          <Text style={styles.issuerText} numberOfLines={1}>
            {item.issuer || '2FA Code'}
          </Text>
          {item.account ? (
            <Text style={styles.accountText} numberOfLines={1}>
              {item.account}
            </Text>
          ) : null}
        </View>

        <View style={styles.codeRow}>
          <Text style={[styles.codeText, isUrgent && styles.codeTextUrgent]}>
            {formattedCode}
          </Text>
          <View style={[styles.copyPill, isCopied && styles.copyPillActive]}>
            <Text style={styles.copyPillText}>{isCopied ? t('authenticator.copied') : t('authenticator.copy')}</Text>
          </View>
        </View>

        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPct}%` },
              isUrgent && styles.progressBarFillUrgent,
            ]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('authenticator.title')}</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addHeaderBtn}>
          <Text style={styles.addHeaderBtnText}>+ {t('home.addButton')}</Text>
        </TouchableOpacity>
      </View>

      {activeRelaySession && (
        <View style={styles.streamingBanner}>
          <Text style={styles.streamingEmoji}>⚡</Text>
          <Text style={styles.streamingText}>
            {t('authenticator.streamingBanner', { domain: activeRelaySession.domain || 'Browser' })}
          </Text>
        </View>
      )}

      <View style={styles.timerBar}>
        <Text style={styles.timerLabel}>{t('authenticator.nextCodeIn')}</Text>
        <Text style={[styles.timerValue, isUrgent && styles.timerValueUrgent]}>
          {remainingSec}s
        </Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('authenticator.searchPlaceholder')}
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔑</Text>
            <Text style={styles.emptyTitle}>{t('authenticator.emptyTitle')}</Text>
            <Text style={styles.emptySub}>
              {t('authenticator.emptySub')}
            </Text>
            <TouchableOpacity style={styles.addEmptyBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.addEmptyBtnText}>{t('authenticator.addAccount')}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('authenticator.newAccountTitle')}</Text>

            <Text style={styles.inputLabel}>{t('authenticator.issuer')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('authenticator.issuerPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={issuerInput}
              onChangeText={setIssuerInput}
            />

            <Text style={styles.inputLabel}>{t('authenticator.account')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('authenticator.accountPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={accountInput}
              onChangeText={setAccountInput}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>{t('authenticator.secret')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('authenticator.secretPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={secretInput}
              onChangeText={setSecretInput}
              autoCapitalize="characters"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
                <LinearGradient
                  colors={['#6391ff', '#7c6aff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtn}
                >
                  <Text style={styles.saveBtnText}>{t('save')}</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#090b14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 24,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  addHeaderBtn: {
    backgroundColor: 'rgba(99, 145, 255, 0.15)',
    borderColor: 'rgba(99, 145, 255, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addHeaderBtnText: {
    color: '#6391ff',
    fontSize: 13,
    fontWeight: '700',
  },
  streamingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 145, 255, 0.15)',
    borderColor: 'rgba(99, 145, 255, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
  },
  streamingEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  streamingText: {
    color: '#6391ff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  timerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  timerLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
  },
  timerValue: {
    color: '#6391ff',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timerValueUrgent: {
    color: '#ff4d4f',
  },
  searchBox: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    backgroundColor: 'rgba(99, 145, 255, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  badgeText: {
    color: '#6391ff',
    fontSize: 10,
    fontWeight: '800',
  },
  issuerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  accountText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    flex: 1,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  codeText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  codeTextUrgent: {
    color: '#ff4d4f',
  },
  copyPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  copyPillActive: {
    backgroundColor: 'rgba(99, 145, 255, 0.2)',
    borderColor: '#6391ff',
  },
  copyPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6391ff',
  },
  progressBarFillUrgent: {
    backgroundColor: '#ff4d4f',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  addEmptyBtn: {
    backgroundColor: 'rgba(99, 145, 255, 0.15)',
    borderColor: 'rgba(99, 145, 255, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  addEmptyBtnText: {
    color: '#6391ff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9,11,20,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0f1220',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
  },
  cancelBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
  },
  gradientBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
