/**
 * ============================================================================
 * FlakeSecure Mobile App - TOTP 2FA Authenticator Screen
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { AppIcon } from '../components/CategoryIcons';
import { getTotpItems, saveTotpItem, deleteTotpItem } from '../utils/storage';
import { generateTOTP, getRemainingSeconds } from '../utils/totp';
import { encryptCredentials } from '../utils/crypto';
import { sendTotp } from '../utils/api';

export default function AuthenticatorScreen({ route, navigation }) {
  const activeRelaySession = route?.params?.relaySession || null;
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();

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
        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={() => handleCopy(item, code)}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
            <Text style={[styles.badgeText, { color: colors.gold }]}>2FA</Text>
          </View>
          <Text style={[styles.issuerText, { color: colors.textMain }]} numberOfLines={1}>
            {item.issuer || '2FA Code'}
          </Text>
          {item.account ? (
            <Text style={[styles.accountText, { color: colors.textMuted }]} numberOfLines={1}>
              {item.account}
            </Text>
          ) : null}
        </View>

        <View style={styles.codeRow}>
          <Text style={[styles.codeText, { color: colors.textMain }, isUrgent && { color: colors.danger }]}>
            {formattedCode}
          </Text>
          <View style={[styles.copyBtn, { backgroundColor: isCopied ? colors.goldBg : colors.inputBg, borderColor: isCopied ? colors.gold : colors.border }]}>
            <Text style={[styles.copyBtnText, { color: isCopied ? colors.gold : colors.textSub }]}>
              {isCopied ? t('authenticator.copied') : t('authenticator.copy')}
            </Text>
          </View>
        </View>

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.textMain }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textMain }]}>{t('authenticator.title')}</Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
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
        <Text style={[styles.timerValue, { color: colors.gold }, isUrgent && { color: colors.danger }]}>
          {remainingSec}s
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
              onPress={() => setModalVisible(true)}
            >
              <Text style={[styles.addEmptyBtnText, { color: colors.gold }]}>{t('authenticator.addAccount')}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.isDark ? '#07090e' : 'rgba(0, 0, 0, 0.92)' }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.modalCard || (colors.isDark ? '#0c101b' : '#ffffff'), borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textMain }]}>{t('authenticator.newAccountTitle')}</Text>

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
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
              placeholder={t('authenticator.secretPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={secretInput}
              onChangeText={setSecretInput}
              autoCapitalize="characters"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
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
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addHeaderBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addHeaderBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  streamingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
  },
  streamingText: {
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
    fontSize: 12,
    fontWeight: '600',
  },
  timerValue: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  searchBox: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  issuerText: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  accountText: {
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
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  copyBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
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
  addEmptyBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#07090e',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    borderWidth: 1,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
  },
  gradientBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
