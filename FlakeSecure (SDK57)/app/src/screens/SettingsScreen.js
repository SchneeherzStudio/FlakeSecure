/**
 * ============================================================================
 * FlakeSecure Mobile App - Settings Screen v2.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. ACCOUNT & CLOUD VAULT SYNC:
 *    - Displays active user account information (username, email) and logout action.
 *    - handleSyncVault(): Derives key from stored credentials and syncs encrypted vault with the server.
 * 
 * 2. ACTIVE SESSIONS & SECURITY:
 *    - fetchSessions() / handleTerminateSession(): Lists active login sessions across devices with remote revoke.
 *    - Sharing permissions & whitelist recipient manager.
 * 
 * 3. CUSTOMIZATION & PREFERENCES:
 *    - Language selector (EN, DE, FR, ES) with instant reactive translation updates via useLanguage().
 *    - Date format selector (System, German, ISO).
 *    - Default autofill profile presets (email, username, names, phone).
 * 
 * 4. DANGER ZONE:
 *    - handleDeleteAccount(): Double-confirmed account deletion via API with local vault purge.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  updateAccount,
  getRestrictions,
  addRestriction,
  removeRestriction,
  searchUsers,
  deleteAccount as apiDeleteAccount,
  getSessions,
  deleteSession,
} from '../utils/api';
import { getDefaultProfile, saveDefaultProfile } from '../utils/storage';
import { syncVaultToServer } from '../utils/vault';

export default function SettingsScreen({ navigation }) {
  const { user, logout, updateUser } = useAuth();
  const { locale, changeLanguage, t } = useLanguage();

  const [currentDateFormat, setCurrentDateFormat] = useState('system');
  const [currentShareMode, setCurrentShareMode] = useState(user?.share_mode || 'whitelist');

  const [restrictions, setRestrictions] = useState([]);
  const [loadingRestrictions, setLoadingRestrictions] = useState(true);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [syncingVault, setSyncingVault] = useState(false);

  const [profileEmail, setProfileEmail] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchRestrictions();
    loadProfile();
    fetchActiveSessions();
    loadDateFormat();
  }, []);

  const loadDateFormat = async () => {
    try {
      const fmt = await AsyncStorage.getItem('date_format');
      if (fmt) setCurrentDateFormat(fmt);
    } catch (e) {}
  };

  const handleDateFormatChange = async (fmt) => {
    try {
      setCurrentDateFormat(fmt);
      await AsyncStorage.setItem('date_format', fmt);
    } catch (e) {}
  };

  const loadProfile = async () => {
    try {
      const p = await getDefaultProfile();
      setProfileEmail(p?.email || user?.email || '');
      setProfileUsername(p?.username || user?.username || '');
      setProfileFirstName(p?.firstName || '');
      setProfileLastName(p?.lastName || '');
      setProfilePhone(p?.phone || '');
    } catch (e) {}
  };

  const handleSaveProfile = async () => {
    try {
      await saveDefaultProfile({
        email: profileEmail.trim(),
        username: profileUsername.trim().toLowerCase(),
        firstName: profileFirstName.trim(),
        lastName: profileLastName.trim(),
        phone: profilePhone.trim(),
      });
      Alert.alert(t('success'), t('settings.saveProfile') + ' ✓');
    } catch (e) {
      Alert.alert(t('error'), 'Konnte Profil nicht speichern');
    }
  };

  const fetchRestrictions = async () => {
    try {
      setLoadingRestrictions(true);
      const res = await getRestrictions();
      setRestrictions(res.restrictions || []);
    } catch (e) {
      console.log('Failed to fetch restrictions', e);
    } finally {
      setLoadingRestrictions(false);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await getSessions();
      setSessions(res.sessions || []);
    } catch (e) {
      console.log('Failed to fetch active sessions', e);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleTerminateSession = (sessionId) => {
    Alert.alert(
      t('settings.terminateConfirmTitle'),
      t('settings.terminateConfirmMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('settings.terminate'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSession(sessionId);
              fetchActiveSessions();
            } catch (e) {
              Alert.alert(t('error'), 'Konnte Sitzung nicht beenden');
            }
          },
        },
      ]
    );
  };

  const handleManualVaultSync = async () => {
    try {
      setSyncingVault(true);
      const savedAuthCreds = await SecureStore.getItemAsync('auth_credentials');
      if (savedAuthCreds) {
        const { identifier, password } = JSON.parse(savedAuthCreds);
        const success = await syncVaultToServer(password, identifier || user?.email);
        if (success) {
          Alert.alert(t('success'), t('settings.syncSuccess'));
        } else {
          Alert.alert(t('common.info'), t('settings.syncSuccess'));
        }
      } else {
        Alert.alert(t('common.info'), t('settings.syncSuccess'));
      }
    } catch (e) {
      Alert.alert(t('error'), 'Synchronisation fehlgeschlagen.');
    } finally {
      setSyncingVault(false);
    }
  };

  const handleLanguageChange = async (lang) => {
    try {
      await changeLanguage(lang);
    } catch (e) {
      console.log('Failed to update language', e);
    }
  };

  const handleShareModeChange = async (mode) => {
    try {
      setCurrentShareMode(mode);
      const res = await updateAccount({ share_mode: mode });
      if (res.user) updateUser(res.user);
    } catch (e) {
      console.log('Failed to update share mode', e);
    }
  };

  const handleRemoveRestriction = async (username) => {
    try {
      await removeRestriction(username);
      fetchRestrictions();
    } catch (e) {
      Alert.alert(t('error'), 'Could not remove recipient');
    }
  };

  const handleSearchUsers = async () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;
    try {
      setSearching(true);
      const results = await searchUsers(query);
      setSearchResults(results.users || []);
    } catch (e) {
      console.log('Search failed', e);
    } finally {
      setSearching(false);
    }
  };

  const handleAddRestriction = async (username) => {
    try {
      await addRestriction(username.trim().toLowerCase());
      setSearchModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchRestrictions();
    } catch (e) {
      Alert.alert(t('error'), 'Could not add recipient');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.deleteAccountConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('settings.deleteAccount'),
              t('settings.deleteAccountFinalConfirm'),
              [
                { text: t('cancel'), style: 'cancel' },
                {
                  text: t('delete'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await apiDeleteAccount();
                      await AsyncStorage.clear();
                      await SecureStore.deleteItemAsync('auth_token');
                      await SecureStore.deleteItemAsync('auth_credentials');
                      logout();
                    } catch (e) {
                      Alert.alert(t('error'), 'Konnte Account nicht löschen');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const languages = [
    { code: 'en', label: 'English 🇬🇧' },
    { code: 'de', label: 'Deutsch 🇩🇪' },
    { code: 'fr', label: 'Français 🇫🇷' },
    { code: 'es', label: 'Español 🇪🇸' },
  ];

  const dateFormats = [
    { code: 'system', label: t('settings.dateFormatSystem') },
    { code: 'german', label: t('settings.dateFormatGerman') },
    { code: 'iso', label: t('settings.dateFormatIso') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        {/* Account Info Card */}
        <Text style={styles.sectionHeader}>{t('settings.accountSection')}</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{t('settings.username')}</Text>
          <Text style={styles.value}>{user?.username || '-'}</Text>
          <View style={styles.divider} />
          <Text style={styles.label}>{t('settings.email')}</Text>
          <Text style={styles.value}>{user?.email || '-'}</Text>

          <TouchableOpacity
            style={styles.syncVaultBtn}
            onPress={handleManualVaultSync}
            disabled={syncingVault}
          >
            {syncingVault ? (
              <ActivityIndicator color="#6391ff" size="small" />
            ) : (
              <Text style={styles.syncVaultText}>{t('settings.syncVault')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>{t('common.logout')}</Text>
          </TouchableOpacity>
        </View>

        {/* Active Sessions */}
        <Text style={styles.sectionHeader}>{t('settings.sessionsSection')} ({sessions.length})</Text>
        <View style={styles.card}>
          {loadingSessions ? (
            <ActivityIndicator color="#6391ff" />
          ) : sessions.length === 0 ? (
            <Text style={styles.emptyText}>{t('settings.noSessions')}</Text>
          ) : (
            sessions.map((s, idx) => {
              const isCurrent = s.is_current;
              const info = s.device_info || 'Device';
              const isPhone = info.toLowerCase().includes('phone') || info.toLowerCase().includes('ios') || info.toLowerCase().includes('android');
              const icon = isPhone ? '📱' : '💻';

              return (
                <View key={s.id || idx} style={[styles.sessionItem, idx !== sessions.length - 1 && styles.borderBottom]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={styles.sessionHeaderRow}>
                      <Text style={styles.sessionDevice} numberOfLines={1}>
                        {icon} {info}
                      </Text>
                      {isCurrent && (
                        <View style={styles.currentDeviceBadge}>
                          <View style={styles.greenPulseDot} />
                          <Text style={styles.currentDeviceText}>{t('settings.currentDevice')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.sessionIp}>IP: {s.ip_address || 'Local'}</Text>
                  </View>
                  {!isCurrent ? (
                    <TouchableOpacity onPress={() => handleTerminateSession(s.id)}>
                      <Text style={styles.removeText}>{t('settings.terminate')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.activeNowContainer}>
                      <Text style={styles.activeNowText}>{t('settings.activeNow')}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Shortcuts Section */}
        <Text style={styles.sectionHeader}>{t('settings.shortcutsSection')}</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.dataItem} onPress={() => navigation.navigate('Authenticator')}>
            <Text style={styles.dataItemText}>{t('settings.authenticatorShortcut')}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.dataItem} onPress={() => navigation.navigate('Logs')}>
            <Text style={styles.dataItemText}>{t('settings.logsShortcut')}</Text>
          </TouchableOpacity>
        </View>

        {/* Language Section */}
        <Text style={styles.sectionHeader}>{t('settings.languageSection')}</Text>
        <View style={styles.card}>
          {languages.map((lang, index) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.langItem, index !== languages.length - 1 && styles.borderBottom]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text style={[styles.langText, locale === lang.code && styles.langSelected]}>
                {lang.label}
              </Text>
              {locale === lang.code && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Date Format Section */}
        <Text style={styles.sectionHeader}>{t('settings.dateFormatSection')}</Text>
        <View style={styles.card}>
          {dateFormats.map((fmt, index) => (
            <TouchableOpacity
              key={fmt.code}
              style={[styles.langItem, index !== dateFormats.length - 1 && styles.borderBottom]}
              onPress={() => handleDateFormatChange(fmt.code)}
            >
              <Text style={[styles.langText, currentDateFormat === fmt.code && styles.langSelected]}>
                {fmt.label}
              </Text>
              {currentDateFormat === fmt.code && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Standard Profile Autofill */}
        <Text style={styles.sectionHeader}>{t('settings.autofillSection')}</Text>
        <View style={styles.card}>
          <Text style={styles.profileHint}>
            {t('settings.autofillHint')}
          </Text>

          <Text style={styles.inputLabel}>{t('settings.defaultEmail')}</Text>
          <TextInput
            style={styles.profileInput}
            value={profileEmail}
            onChangeText={setProfileEmail}
            placeholder="email@domain.com"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>{t('settings.defaultUsername')}</Text>
          <TextInput
            style={styles.profileInput}
            value={profileUsername}
            onChangeText={setProfileUsername}
            placeholder="username"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="none"
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>{t('settings.firstName')}</Text>
              <TextInput
                style={styles.profileInput}
                value={profileFirstName}
                onChangeText={setProfileFirstName}
                placeholder="Max"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="words"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>{t('settings.lastName')}</Text>
              <TextInput
                style={styles.profileInput}
                value={profileLastName}
                onChangeText={setProfileLastName}
                placeholder="Mustermann"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="words"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>{t('settings.phone')}</Text>
          <TextInput
            style={styles.profileInput}
            value={profilePhone}
            onChangeText={setProfilePhone}
            placeholder="+49 170 1234567"
            placeholderTextColor="rgba(255,255,255,0.25)"
            keyboardType="phone-pad"
          />

          <TouchableOpacity style={styles.saveProfileBtn} onPress={handleSaveProfile}>
            <Text style={styles.saveProfileBtnText}>{t('settings.saveProfile')}</Text>
          </TouchableOpacity>
        </View>

        {/* Sharing & Restrictions */}
        <Text style={styles.sectionHeader}>{t('settings.securitySection')}</Text>
        <View style={styles.card}>
          <Text style={styles.subLabel}>{t('settings.whoCanSend')}</Text>
          <View style={styles.shareModeContainer}>
            {['only_me', 'whitelist', 'all'].map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.shareModeBtn, currentShareMode === mode && styles.shareModeBtnActive]}
                onPress={() => handleShareModeChange(mode)}
              >
                <Text style={[styles.shareModeText, currentShareMode === mode && styles.shareModeTextActive]}>
                  {mode === 'only_me' ? t('settings.onlyMe') : mode === 'whitelist' ? t('settings.whitelist') : t('settings.anyone')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {currentShareMode === 'whitelist' && (
            <>
              <View style={styles.divider} />
              <View style={styles.recipientHeader}>
                <Text style={styles.subLabel}>{t('settings.allowedRecipients')}</Text>
                <TouchableOpacity onPress={() => setSearchModalVisible(true)}>
                  <Text style={styles.addBtn}>{t('settings.addRecipient')}</Text>
                </TouchableOpacity>
              </View>

              {loadingRestrictions ? (
                <ActivityIndicator color="#6391ff" />
              ) : restrictions.length === 0 ? (
                <Text style={styles.emptyText}>{t('settings.noRecipients')}</Text>
              ) : (
                restrictions.map((r, idx) => (
                  <View key={r.id || idx} style={[styles.recipientItem, idx !== restrictions.length - 1 && styles.borderBottom]}>
                    <Text style={styles.recipientName}>👤 {r.recipient_username || r.username}</Text>
                    <TouchableOpacity onPress={() => handleRemoveRestriction(r.recipient_username || r.username)}>
                      <Text style={styles.removeText}>{t('delete')}</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
        </View>

        {/* Data & Sharing Mode */}
        <Text style={styles.sectionHeader}>{t('settings.dataSection')}</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.dataItem} onPress={() => navigation.navigate('ShareImport', { mode: 'import' })}>
            <Text style={styles.dataItemText}>{t('settings.importDevice')}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.dataItem} onPress={() => navigation.navigate('ShareImport', { mode: 'export' })}>
            <Text style={styles.dataItemText}>{t('settings.exportDevice')}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.dataItem} onPress={() => navigation.navigate('ShareImport', { mode: 'share' })}>
            <Text style={styles.dataItemText}>{t('settings.shareLogins')}</Text>
          </TouchableOpacity>
        </View>

        {/* Legal & Privacy Section */}
        <Text style={styles.sectionHeader}>{t('settings.legalSection')}</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.dataItem}
            onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/legal')}
          >
            <Text style={styles.dataItemText}>{t('settings.privacyPolicy')}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.dataItem}
            onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/imprint')}
          >
            <Text style={styles.dataItemText}>{t('settings.imprint')}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.dataItem}
            onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/terms')}
          >
            <Text style={styles.dataItemText}>{t('settings.termsOfService')}</Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <Text style={[styles.sectionHeader, { color: '#ff4d4f' }]}>{t('settings.dangerSection')}</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount}>
            <Text style={styles.dangerText}>{t('settings.deleteAccount')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* User Search Modal */}
      <Modal visible={searchModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.addRecipient')}</Text>
              <TouchableOpacity onPress={() => setSearchModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                placeholder="Username eingeben..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearchUsers}>
                <Text style={styles.searchBtnText}>🔍</Text>
              </TouchableOpacity>
            </View>

            {searching ? (
              <ActivityIndicator color="#6391ff" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.searchResultItem} onPress={() => handleAddRestriction(item.username)}>
                    <Text style={styles.searchResultText}>👤 {item.username}</Text>
                    <Text style={styles.searchResultAdd}>+ Hinzufügen</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  searchQuery.length > 0 && !searching ? (
                    <Text style={styles.emptyText}>Keine Benutzer gefunden</Text>
                  ) : null
                }
              />
            )}
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
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  backButtonText: {
    color: '#6391ff',
    fontSize: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 12,
  },
  syncVaultBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(99, 145, 255, 0.12)',
    borderColor: 'rgba(99, 145, 255, 0.3)',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  syncVaultText: {
    color: '#6391ff',
    fontSize: 13,
    fontWeight: '700',
  },
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  logoutText: {
    color: '#ff4d4f',
    fontSize: 14,
    fontWeight: '700',
  },
  langItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  langText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  langSelected: {
    color: '#6391ff',
    fontWeight: '700',
  },
  checkMark: {
    color: '#6391ff',
    fontSize: 16,
    fontWeight: '800',
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 3,
  },
  sessionDevice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  currentDeviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  currentDeviceText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '700',
  },
  activeNowContainer: {
    backgroundColor: 'rgba(99, 145, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeNowText: {
    color: '#6391ff',
    fontSize: 11,
    fontWeight: '700',
  },
  sessionIp: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  profileHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  profileInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
  },
  saveProfileBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(99, 145, 255, 0.15)',
    borderColor: 'rgba(99, 145, 255, 0.35)',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveProfileBtnText: {
    color: '#6391ff',
    fontSize: 13,
    fontWeight: '700',
  },
  shareModeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  shareModeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  shareModeBtnActive: {
    backgroundColor: 'rgba(99, 145, 255, 0.15)',
    borderColor: '#6391ff',
  },
  shareModeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  shareModeTextActive: {
    color: '#6391ff',
    fontWeight: '700',
  },
  recipientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addBtn: {
    fontSize: 12,
    color: '#6391ff',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  recipientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  recipientName: {
    fontSize: 14,
    color: '#fff',
  },
  removeText: {
    fontSize: 12,
    color: '#ff4d4f',
    fontWeight: '600',
  },
  dataItem: {
    paddingVertical: 8,
  },
  dataItemText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  dangerCard: {
    borderColor: 'rgba(255,77,79,0.3)',
    backgroundColor: 'rgba(255,77,79,0.04)',
  },
  dangerBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dangerText: {
    color: '#ff4d4f',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f1220',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalClose: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
  },
  searchBox: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: 'rgba(99, 145, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 145, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    fontSize: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  searchResultText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  searchResultAdd: {
    fontSize: 12,
    color: '#6391ff',
    fontWeight: '700',
  },
});
