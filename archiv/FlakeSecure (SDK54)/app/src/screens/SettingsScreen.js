/**
 * ============================================================================
 * FlakeSecure Mobile App - Settings Screen v2.1.0 (Submenu Architecture)
 * ============================================================================
 *
 * FUNCTION OVERVIEW:
 *
 * 1. MAIN SETTINGS OVERVIEW (activeSubmenu === null):
 *    - Displays clean navigation links to 6 logical submenus:
 *      (a) Account & Cloud Vault ('account')
 *      (b) Autofill & Default Profile ('autofill')
 *      (c) Notifications & Security Alerts ('notifications')
 *      (d) Sessions & Sharing Security ('security')
 *      (e) Appearance, Language & Format ('appearance')
 *      (f) Data, Tools & Legal ('data')
 *    - Displays the System & Security Information (App Information) card.
 *
 * 2. DEDICATED SUBMENUS (activeSubmenu !== null):
 *    - Renders only the selected submenu's settings with instant back-navigation
 *      (both header back button and Android hardware BackHandler).
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Linking,
  Platform,
  Switch,
  AppState,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
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
import {
  getServerPushPrefs,
  saveServerPushPrefs,
  syncServerPushPrefsFromBackend,
  getLocalNotificationPrefs,
  saveLocalNotificationPrefs,
  runLocalSecurityNotificationsCheck,
  DEFAULT_SERVER_PUSH_PREFS,
  DEFAULT_LOCAL_NOTIFICATION_PREFS,
} from '../utils/notifications';
import {
  isAutofillSupported,
  isAutofillEnabled,
  openAutofillSettings,
  syncVaultToNativeAutofill,
  importPendingAutofillSaves,
} from '../utils/autofillBridge';
import { SessionCardSkeleton, SkeletonItem } from '../components/Skeleton';
import { TapFeedback } from '../components/TapFeedback';
import { AppIcon } from '../components/CategoryIcons';
import { clearFaviconCache } from '../components/FaviconImage';
import FlakeToggle from '../components/FlakeToggle';

export default function SettingsScreen({ navigation, route }) {
  const { user, logout, updateUser, isOfflineMode } = useAuth();
  const { locale, changeLanguage, t } = useLanguage();
  const { themeMode, setThemeMode, colors } = useTheme();
  const toast = useToast();

  // null = Main Settings overview (Submenu links + App Info)
  // 'account' | 'autofill' | 'notifications' | 'security' | 'appearance' | 'data'
  const [activeSubmenu, setActiveSubmenu] = useState(
    route?.params?.submenu || null
  );

  const [currentDateFormat, setCurrentDateFormat] = useState('system');
  const [currentShareMode, setCurrentShareMode] = useState(
    user?.share_mode || 'whitelist'
  );

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

  // Android Native Autofill state
  const [autofillSupported, setAutofillSupported] = useState(false);
  const [autofillEnabled, setAutofillEnabled] = useState(false);
  const [syncingAutofill, setSyncingAutofill] = useState(false);

  // Push & Local Notification preferences state
  const [serverPushPrefs, setServerPushPrefs] = useState(
    DEFAULT_SERVER_PUSH_PREFS || {}
  );
  const [localNotifPrefs, setLocalNotifPrefs] = useState(
    DEFAULT_LOCAL_NOTIFICATION_PREFS || {}
  );
  const [runningSecurityCheck, setRunningSecurityCheck] = useState(false);

  useEffect(() => {
    if (route?.params?.submenu) {
      setActiveSubmenu(route.params.submenu);
    }
  }, [route?.params?.submenu]);

  // Intercept Android hardware back button when inside a submenu
  useEffect(() => {
    if (!activeSubmenu) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveSubmenu(null);
      return true;
    });
    return () => sub.remove();
  }, [activeSubmenu]);

  const refreshAutofillStatus = useCallback(async () => {
    try {
      const supported = await isAutofillSupported();
      setAutofillSupported(supported);
      if (supported) {
        const enabled = await isAutofillEnabled();
        setAutofillEnabled(enabled);
      } else {
        setAutofillEnabled(false);
      }
    } catch {
      setAutofillSupported(false);
      setAutofillEnabled(false);
    }
  }, []);

  const loadNotificationPreferences = useCallback(async () => {
    try {
      const [localSrv, localChecks] = await Promise.all([
        getServerPushPrefs(),
        getLocalNotificationPrefs(),
      ]);
      setServerPushPrefs(localSrv || DEFAULT_SERVER_PUSH_PREFS || {});
      setLocalNotifPrefs(localChecks || DEFAULT_LOCAL_NOTIFICATION_PREFS || {});

      if (!isOfflineMode) {
        const synced = await syncServerPushPrefsFromBackend();
        if (synced) setServerPushPrefs(synced);
      }
    } catch {}
  }, [isOfflineMode]);

  useEffect(() => {
    fetchRestrictions();
    loadProfile();
    fetchActiveSessions();
    loadDateFormat();
    refreshAutofillStatus();
    loadNotificationPreferences();
  }, [refreshAutofillStatus, loadNotificationPreferences]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshAutofillStatus();
      }
    });
    return () => sub.remove();
  }, [refreshAutofillStatus]);

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
      toast.success(t('success'), t('settings.saveProfile'));
    } catch (e) {
      toast.error(t('error'), 'Konnte Profil nicht speichern');
    }
  };

  const fetchRestrictions = async () => {
    if (isOfflineMode) {
      setLoadingRestrictions(false);
      return;
    }
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
    if (isOfflineMode) {
      setLoadingSessions(false);
      return;
    }
    try {
      setLoadingSessions(true);
      const res = await getSessions();
      setSessions(res.sessions || []);
    } catch (e) {
      console.log('Failed to fetch sessions', e);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleTerminateSession = (sessionId) => {
    if (isOfflineMode) {
      toast.warn(
        t('offline.actionRequiresOnlineTitle'),
        t('offline.actionRequiresOnlineMsg')
      );
      return;
    }
    toast.confirm({
      title: t('settings.terminateSession'),
      message: t('settings.terminateSessionConfirm'),
      confirmText: t('settings.terminate'),
      cancelText: t('cancel'),
      destructive: true,
      icon: 'shield',
      onConfirm: async () => {
        try {
          await deleteSession(sessionId);
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          toast.success(t('success'), t('settings.terminateSession'));
        } catch (e) {
          toast.error(t('error'), 'Konnte Sitzung nicht beenden');
        }
      },
    });
  };

  const handleManualVaultSync = async () => {
    if (isOfflineMode) {
      toast.warn(
        t('offline.actionRequiresOnlineTitle'),
        t('offline.actionRequiresOnlineMsg')
      );
      return;
    }
    setSyncingVault(true);
    try {
      const saved = await SecureStore.getItemAsync('auth_credentials');
      if (!saved) {
        toast.error(
          t('error'),
          'Keine Anmeldedaten für die Tresor-Verschlüsselung gefunden.'
        );
        setSyncingVault(false);
        return;
      }
      const { password, identifier, email } = JSON.parse(saved);
      const success = await syncVaultToServer(password, identifier, email);
      if (success) {
        toast.success(
          t('success'),
          'Tresor erfolgreich verschlüsselt in die Cloud synchronisiert.'
        );
      } else {
        toast.error(t('error'), 'Tresor-Synchronisation fehlgeschlagen.');
      }
    } catch (e) {
      console.log('Manual sync vault error:', e);
      toast.error(t('error'), e.message || 'Fehler beim Tresor-Sync');
    } finally {
      setSyncingVault(false);
    }
  };

  const handleLanguageChange = async (langCode) => {
    try {
      await changeLanguage(langCode);
      if (user && !isOfflineMode) {
        updateAccount({ language: langCode }).catch(() => {});
      }
    } catch (e) {
      console.log('Failed to change language', e);
    }
  };

  const handleShareModeChange = async (mode) => {
    if (isOfflineMode) {
      toast.warn(
        t('offline.actionRequiresOnlineTitle'),
        t('offline.actionRequiresOnlineMsg')
      );
      return;
    }
    try {
      setCurrentShareMode(mode);
      await updateAccount({ share_mode: mode });
      updateUser({ ...user, share_mode: mode });
    } catch (e) {
      toast.error(t('error'), 'Could not update sharing mode');
    }
  };

  const handleRemoveRestriction = (recipientUsername) => {
    if (isOfflineMode) {
      toast.warn(
        t('offline.actionRequiresOnlineTitle'),
        t('offline.actionRequiresOnlineMsg')
      );
      return;
    }
    toast.confirm({
      title: t('settings.removeRecipient'),
      message: t('settings.removeRecipientConfirm', {
        username: recipientUsername,
      }),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      destructive: true,
      icon: 'trash',
      onConfirm: async () => {
        try {
          await removeRestriction(recipientUsername);
          setRestrictions(
            restrictions.filter(
              (r) => (r.recipient_username || r.username) !== recipientUsername
            )
          );
        } catch (e) {
          toast.error(t('error'), 'Could not remove recipient');
        }
      },
    });
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    if (isOfflineMode) {
      toast.warn(
        t('offline.actionRequiresOnlineTitle'),
        t('offline.actionRequiresOnlineMsg')
      );
      return;
    }
    setSearching(true);
    try {
      const res = await searchUsers(searchQuery.trim());
      setSearchResults(res.users || []);
    } catch (e) {
      console.log('Search users failed', e);
    } finally {
      setSearching(false);
    }
  };

  const handleAddRestriction = async (targetUsername) => {
    if (isOfflineMode) {
      toast.warn(
        t('offline.actionRequiresOnlineTitle'),
        t('offline.actionRequiresOnlineMsg')
      );
      return;
    }
    try {
      await addRestriction(targetUsername);
      setSearchModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchRestrictions();
      toast.success(
        t('success'),
        `${targetUsername} added to allowed recipients`
      );
    } catch (e) {
      toast.error(t('error'), 'Could not add recipient');
    }
  };

  const handleClearIconCache = async () => {
    try {
      await clearFaviconCache();
      toast.success(t('success'), t('settings.iconCacheCleared'));
    } catch (e) {
      toast.error(t('error'), e.message || 'Error');
    }
  };

  const handleOpenAutofillSettings = async () => {
    const opened = await openAutofillSettings();
    if (!opened) {
      toast.info(t('autofill.sectionTitle'), t('autofill.androidOnlyHint'));
    }
  };

  const handleSyncAutofillNow = async () => {
    setSyncingAutofill(true);
    try {
      await importPendingAutofillSaves();
      const ok = await syncVaultToNativeAutofill();
      await refreshAutofillStatus();
      if (ok) {
        toast.success(t('success'), t('autofill.syncSuccess'));
      } else {
        toast.info(t('autofill.sectionTitle'), t('autofill.androidOnlyHint'));
      }
    } catch (e) {
      toast.error(t('error'), e?.message || 'Autofill sync failed');
    } finally {
      setSyncingAutofill(false);
    }
  };

  const handleToggleServerPushPref = async (key, value) => {
    const updated = { ...(serverPushPrefs || {}), [key]: value };
    setServerPushPrefs(updated);
    await saveServerPushPrefs(updated, locale);
  };

  const handleToggleLocalNotifPref = async (key, value) => {
    const updated = { ...(localNotifPrefs || {}), [key]: value };
    setLocalNotifPrefs(updated);
    await saveLocalNotificationPrefs(updated);
  };

  const handleRunSecurityCheckNow = async () => {
    setRunningSecurityCheck(true);
    try {
      await runLocalSecurityNotificationsCheck(t, { force: true });
      toast.success(t('success'), t('notifications.securityCheckCompleted'));
    } catch (e) {
      toast.error(t('error'), e?.message || 'Error');
    } finally {
      setRunningSecurityCheck(false);
    }
  };

  const handleDeleteAccount = () => {
    if (isOfflineMode) {
      toast.warn(
        t('offline.actionRequiresOnlineTitle'),
        t('offline.accountDeleteRequiresOnline')
      );
      return;
    }
    toast.confirm({
      title: t('settings.deleteAccount'),
      message: t('settings.deleteAccountConfirm'),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      destructive: true,
      icon: 'trash',
      onConfirm: () => {
        setTimeout(() => {
          toast.confirm({
            title: t('settings.deleteAccount'),
            message: t('settings.deleteAccountFinalConfirm'),
            confirmText: t('delete'),
            cancelText: t('cancel'),
            destructive: true,
            icon: 'trash',
            onConfirm: async () => {
              try {
                await apiDeleteAccount();
                await AsyncStorage.clear();
                await SecureStore.deleteItemAsync('auth_token');
                await SecureStore.deleteItemAsync('auth_credentials');
                logout();
              } catch (e) {
                toast.error(t('error'), 'Konnte Account nicht löschen');
              }
            },
          });
        }, 220);
      },
    });
  };

  const languages = [
    { code: 'en', label: 'English', badge: 'EN' },
    { code: 'de', label: 'Deutsch', badge: 'DE' },
    { code: 'fr', label: 'Français', badge: 'FR' },
    { code: 'es', label: 'Español', badge: 'ES' },
  ];

  const dateFormats = [
    { code: 'system', label: t('settings.dateFormatSystem') },
    { code: 'german', label: t('settings.dateFormatGerman') },
    { code: 'iso', label: t('settings.dateFormatIso') },
  ];

  const serverPushItems = [
    {
      key: 'new_device_login',
      title: t('notifications.prefNewDeviceTitle'),
      desc: t('notifications.prefNewDeviceDesc'),
    },
    {
      key: 'failed_login_attempts',
      title: t('notifications.prefFailedLoginsTitle'),
      desc: t('notifications.prefFailedLoginsDesc'),
    },
    {
      key: 'share_events',
      title: t('notifications.prefShareEventsTitle'),
      desc: t('notifications.prefShareEventsDesc'),
    },
    {
      key: 'share_expiring',
      title: t('notifications.prefShareExpiringTitle'),
      desc: t('notifications.prefShareExpiringDesc'),
    },
    {
      key: 'vault_sync_conflict',
      title: t('notifications.prefVaultConflictTitle'),
      desc: t('notifications.prefVaultConflictDesc'),
    },
  ];

  const localCheckItems = [
    {
      key: 'card_expiry',
      title: t('notifications.prefCardExpiryTitle'),
      desc: t('notifications.prefCardExpiryDesc'),
    },
    {
      key: 'breach_check',
      title: t('notifications.prefBreachCheckTitle'),
      desc: t('notifications.prefBreachCheckDesc'),
    },
    {
      key: 'weak_passwords',
      title: t('notifications.prefWeakPasswordsTitle'),
      desc: t('notifications.prefWeakPasswordsDesc'),
    },
    {
      key: 'backup_reminder',
      title: t('notifications.prefBackupReminderTitle'),
      desc: t('notifications.prefBackupReminderDesc'),
    },
  ];

  const submenuDefinitions = [
    {
      id: 'account',
      icon: 'user',
      title: t('settings.menuAccountTitle'),
      subtitle:
        user?.username && user?.email
          ? `${user.username} • ${user.email}`
          : t('settings.menuAccountSub'),
      badge: isOfflineMode ? 'OFFLINE' : null,
      badgeColor: '#f59e0b',
    },
    {
      id: 'autofill',
      icon: 'smartphone',
      title: t('settings.menuAutofillTitle'),
      subtitle: t('settings.menuAutofillSub'),
      badge:
        Platform.OS === 'android'
          ? autofillEnabled
            ? t('autofill.statusActive')
            : null
          : null,
      badgeColor: colors.green,
    },
    {
      id: 'notifications',
      icon: 'bell',
      title: t('settings.menuNotificationsTitle'),
      subtitle: t('settings.menuNotificationsSub'),
    },
    {
      id: 'security',
      icon: 'shield',
      title: t('settings.menuSecurityTitle'),
      subtitle: t('settings.menuSecuritySub'),
      badge: !isOfflineMode && sessions.length > 0 ? String(sessions.length) : null,
      badgeColor: colors.gold,
    },
    {
      id: 'appearance',
      icon: 'sun',
      title: t('settings.menuAppearanceTitle'),
      subtitle: t('settings.menuAppearanceSub'),
      badge: (locale || 'en').toUpperCase(),
      badgeColor: colors.gold,
    },
    {
      id: 'data',
      icon: 'share',
      title: t('settings.menuDataTitle'),
      subtitle: t('settings.menuDataSub'),
    },
  ];

  const activeSubmenuObj = submenuDefinitions.find(
    (m) => m.id === activeSubmenu
  );

  const handleBackPress = () => {
    if (activeSubmenu) {
      setActiveSubmenu(null);
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <AppIcon name="back" size={20} color={colors.gold} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {activeSubmenuObj ? activeSubmenuObj.title : t('settings.title')}
          </Text>
          {activeSubmenuObj && (
            <Text
              style={[styles.headerSubtitle, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {t('settings.title')}
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {/* ================================================================
            MAIN SETTINGS OVERVIEW: Submenu Links + App Information ONLY
           ================================================================ */}
        {!activeSubmenu && (
          <>
            <Text
              style={[
                styles.sectionHeader,
                { color: colors.textMuted, marginTop: 6 },
              ]}
            >
              {t('settings.submenusSection')}
            </Text>

            <View
              style={[
                styles.menuCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              {submenuDefinitions.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.menuRow,
                    idx !== submenuDefinitions.length - 1 && styles.borderBottom,
                    { borderBottomColor: colors.borderSubtle },
                  ]}
                  onPress={() => setActiveSubmenu(item.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.menuIconBox,
                      {
                        backgroundColor: colors.goldDim,
                        borderColor: colors.goldBorder,
                      },
                    ]}
                  >
                    <AppIcon name={item.icon} size={18} color={colors.gold} />
                  </View>

                  <View style={styles.menuTextCol}>
                    <Text
                      style={[styles.menuRowTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.menuRowSubtitle,
                        { color: colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  </View>

                  {!!item.badge && (
                    <View
                      style={[
                        styles.menuBadgePill,
                        {
                          backgroundColor: colors.goldDim,
                          borderColor: colors.goldBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.menuBadgeText,
                          { color: item.badgeColor || colors.gold },
                        ]}
                      >
                        {item.badge}
                      </Text>
                    </View>
                  )}

                  <AppIcon
                    name="chevronRight"
                    size={16}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* System & Security Information (App Info) */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
              {t('settings.aboutSection')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View style={styles.aboutHeader}>
                <View
                  style={[
                    styles.aboutLogoContainer,
                    {
                      backgroundColor: colors.goldDim,
                      borderColor: colors.goldBorder,
                    },
                  ]}
                >
                  <AppIcon name="logo" size={26} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aboutTitle, { color: colors.text }]}>
                    FlakeSecure
                  </Text>
                  <Text
                    style={[styles.aboutSubtitle, { color: colors.textMuted }]}
                  >
                    {t('settings.tagline')}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.borderSubtle },
                ]}
              />

              {/* App Version */}
              <View
                style={[
                  styles.infoRow,
                  { borderBottomColor: colors.borderSubtle },
                ]}
              >
                <View style={styles.infoLabelContainer}>
                  <AppIcon name="lock" size={14} color={colors.gold} />
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('settings.appVersion')}
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  v{Constants?.expoConfig?.version || '2.1.0'}
                </Text>
              </View>

              {/* Platform / Architecture */}
              <View
                style={[
                  styles.infoRow,
                  { borderBottomColor: colors.borderSubtle },
                ]}
              >
                <View style={styles.infoLabelContainer}>
                  <AppIcon name="logs" size={14} color={colors.gold} />
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('settings.buildArchitecture')}
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {Platform.OS === 'ios'
                    ? 'iOS'
                    : Platform.OS === 'android'
                    ? 'Android'
                    : 'Universal'}{' '}
                  • Hermes
                </Text>
              </View>

              {/* Encryption Standard */}
              <View
                style={[
                  styles.infoRow,
                  { borderBottomColor: colors.borderSubtle },
                ]}
              >
                <View style={styles.infoLabelContainer}>
                  <AppIcon name="shield" size={14} color={colors.gold} />
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('settings.encryptionStandard')}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.infoValue,
                    { color: colors.gold, fontWeight: '700' },
                  ]}
                >
                  AES-256-CTR
                </Text>
              </View>

              {/* Key Derivation */}
              <View
                style={[
                  styles.infoRow,
                  { borderBottomColor: colors.borderSubtle },
                ]}
              >
                <View style={styles.infoLabelContainer}>
                  <AppIcon name="key" size={14} color={colors.gold} />
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('settings.keyDerivation')}
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  Argon2id + PBKDF
                </Text>
              </View>

              {/* Security Architecture */}
              <View
                style={[
                  styles.infoRow,
                  { borderBottomColor: colors.borderSubtle },
                ]}
              >
                <View style={styles.infoLabelContainer}>
                  <AppIcon name="shield" size={14} color={colors.gold} />
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('settings.securityArchitecture')}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.infoValue,
                    { color: colors.green, fontWeight: '700' },
                  ]}
                >
                  {t('settings.securityModelZeroKnowledge')}
                </Text>
              </View>

              {/* Biometrics & Hardware */}
              <View
                style={[
                  styles.infoRow,
                  { borderBottomColor: colors.borderSubtle },
                ]}
              >
                <View style={styles.infoLabelContainer}>
                  <AppIcon name="user" size={14} color={colors.gold} />
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('settings.biometricEnclave')}
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {t('settings.hardwareBacked')}
                </Text>
              </View>

              {/* Relay Protocol */}
              <View
                style={[
                  styles.infoRow,
                  { borderBottomColor: colors.borderSubtle },
                ]}
              >
                <View style={styles.infoLabelContainer}>
                  <AppIcon name="share" size={14} color={colors.gold} />
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('settings.networkSecurity')}
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  WSS / TLS 1.3
                </Text>
              </View>

              {/* Connected Server */}
              <View
                style={[
                  styles.infoRow,
                  { borderBottomWidth: 0, paddingBottom: 2 },
                ]}
              >
                <View style={styles.infoLabelContainer}>
                  <AppIcon name="globe" size={14} color={colors.gold} />
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('settings.serverOrigin')}
                  </Text>
                </View>
                <Text
                  style={[styles.infoValue, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  flakesecure.snowystudio.dev
                </Text>
              </View>
            </View>

            {/* Footer Brand watermark */}
            <View style={styles.footerBrand}>
              <Text
                style={[styles.footerBrandText, { color: colors.textMuted }]}
              >
                FlakeSecure • Schneeherz Studio • 2026
              </Text>
            </View>
          </>
        )}

        {/* ================================================================
            SUBMENU 1: ACCOUNT & CLOUD VAULT ('account')
           ================================================================ */}
        {activeSubmenu === 'account' && (
          <>
            <Text
              style={[
                styles.sectionHeader,
                { color: colors.textMuted, marginTop: 6 },
              ]}
            >
              {t('settings.accountSection')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={[styles.label, { color: colors.textMuted }]}>
                    {t('settings.username')}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    {user?.username || '-'}
                  </Text>
                </View>
                {isOfflineMode && (
                  <View
                    style={[
                      styles.offlinePill,
                      {
                        backgroundColor: 'rgba(245, 158, 11, 0.14)',
                        borderColor: 'rgba(245, 158, 11, 0.4)',
                      },
                    ]}
                  >
                    <AppIcon name="offline-cloud" size={12} color="#f59e0b" />
                    <Text style={styles.offlinePillText}>
                      {t('offline.bannerTitle')}
                    </Text>
                  </View>
                )}
              </View>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.borderSubtle },
                ]}
              />
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t('settings.email')}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {user?.email || '-'}
              </Text>

              <TouchableOpacity
                style={[
                  styles.syncVaultBtn,
                  {
                    backgroundColor: colors.goldDim,
                    borderColor: colors.goldBorder,
                  },
                  isOfflineMode && { opacity: 0.55 },
                ]}
                onPress={handleManualVaultSync}
                disabled={syncingVault}
              >
                {syncingVault ? (
                  <ActivityIndicator color={colors.gold} size="small" />
                ) : (
                  <Text style={[styles.syncVaultText, { color: colors.gold }]}>
                    {t('settings.syncVault')}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.restoreVaultBtn,
                  {
                    backgroundColor: colors.cardHover,
                    borderColor: colors.cardBorder,
                  },
                ]}
                onPress={() =>
                  navigation.navigate('VaultTransfer', {
                    mode: 'check_or_receive',
                  })
                }
              >
                <Text style={[styles.restoreVaultText, { color: colors.text }]}>
                  {t('settings.restoreVault')}
                </Text>
              </TouchableOpacity>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.borderSubtle },
                ]}
              />
              <TapFeedback style={styles.logoutBtn} onPress={logout}>
                <Text style={[styles.logoutText, { color: colors.red }]}>
                  {t('common.logout')}
                </Text>
              </TapFeedback>
            </View>

            {/* Danger Zone */}
            <Text style={[styles.sectionHeader, { color: colors.red }]}>
              {t('settings.dangerSection')}
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.redDim,
                  borderColor: colors.redBorder,
                },
                isOfflineMode && { opacity: 0.55 },
              ]}
            >
              <TapFeedback
                style={styles.dangerBtn}
                onPress={handleDeleteAccount}
              >
                <Text style={[styles.dangerText, { color: colors.red }]}>
                  {t('settings.deleteAccount')}
                </Text>
              </TapFeedback>
            </View>
          </>
        )}

        {/* ================================================================
            SUBMENU 2: AUTOFILL & DEFAULT PROFILE ('autofill')
           ================================================================ */}
        {activeSubmenu === 'autofill' && (
          <>
            <Text
              style={[
                styles.sectionHeader,
                { color: colors.textMuted, marginTop: 6 },
              ]}
            >
              {t('autofill.sectionTitle')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View style={styles.autofillTopRow}>
                <View
                  style={[
                    styles.autofillIconBox,
                    {
                      backgroundColor: colors.goldDim,
                      borderColor: colors.goldBorder,
                    },
                  ]}
                >
                  <AppIcon name="smartphone" size={20} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.autofillCardTitle, { color: colors.text }]}
                  >
                    {t('autofill.cardTitle')}
                  </Text>
                  <View style={styles.autofillStatusBadgeRow}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: !autofillSupported
                            ? colors.textMuted
                            : autofillEnabled
                            ? colors.green
                            : '#f59e0b',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.autofillStatusText,
                        {
                          color: !autofillSupported
                            ? colors.textMuted
                            : autofillEnabled
                            ? colors.green
                            : '#f59e0b',
                        },
                      ]}
                    >
                      {!autofillSupported
                        ? Platform.OS === 'android'
                          ? t('autofill.statusDisabled')
                          : 'Android 8.0+'
                        : autofillEnabled
                        ? t('autofill.statusEnabled')
                        : t('autofill.statusDisabled')}
                    </Text>
                  </View>
                </View>
              </View>

              <Text
                style={[
                  styles.profileHint,
                  { color: colors.textMuted, marginTop: 8 },
                ]}
              >
                {t('autofill.cardDesc')}
              </Text>

              <View
                style={[
                  styles.autofillInfoBox,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              >
                <AppIcon name="shield" size={14} color={colors.gold} />
                <Text
                  style={[
                    styles.autofillInfoText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {Platform.OS === 'android'
                    ? t('autofill.biometricRequiredHint')
                    : t('autofill.androidOnlyHint')}
                </Text>
              </View>

              {Platform.OS === 'android' && (
                <View style={styles.autofillActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.autofillActionBtn,
                      {
                        backgroundColor: colors.goldDim,
                        borderColor: colors.goldBorder,
                        flex: 1.2,
                      },
                    ]}
                    onPress={handleOpenAutofillSettings}
                  >
                    <AppIcon name="gear" size={14} color={colors.gold} />
                    <Text
                      style={[
                        styles.autofillActionBtnText,
                        { color: colors.gold },
                      ]}
                      numberOfLines={1}
                    >
                      {t('autofill.openSystemSettingsBtn')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.autofillActionBtn,
                      {
                        backgroundColor: colors.cardHover,
                        borderColor: colors.cardBorder,
                        flex: 1,
                      },
                    ]}
                    onPress={handleSyncAutofillNow}
                    disabled={syncingAutofill}
                  >
                    {syncingAutofill ? (
                      <ActivityIndicator size="small" color={colors.gold} />
                    ) : (
                      <>
                        <AppIcon name="refresh" size={14} color={colors.text} />
                        <Text
                          style={[
                            styles.autofillActionBtnText,
                            { color: colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {t('autofill.syncNowBtn')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Standard Profile Autofill */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
              {t('settings.autofillSection')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <Text style={[styles.profileHint, { color: colors.textMuted }]}>
                {t('settings.autofillHint')}
              </Text>

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                {t('settings.defaultEmail')}
              </Text>
              <TextInput
                style={[
                  styles.profileInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                value={profileEmail}
                onChangeText={setProfileEmail}
                placeholder="email@domain.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                {t('settings.defaultUsername')}
              </Text>
              <TextInput
                style={[
                  styles.profileInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                value={profileUsername}
                onChangeText={setProfileUsername}
                placeholder="username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.inputLabel, { color: colors.textMuted }]}
                  >
                    {t('settings.firstName')}
                  </Text>
                  <TextInput
                    style={[
                      styles.profileInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      },
                    ]}
                    value={profileFirstName}
                    onChangeText={setProfileFirstName}
                    placeholder="Max"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.inputLabel, { color: colors.textMuted }]}
                  >
                    {t('settings.lastName')}
                  </Text>
                  <TextInput
                    style={[
                      styles.profileInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      },
                    ]}
                    value={profileLastName}
                    onChangeText={setProfileLastName}
                    placeholder="Mustermann"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                {t('settings.phone')}
              </Text>
              <TextInput
                style={[
                  styles.profileInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                value={profilePhone}
                onChangeText={setProfilePhone}
                placeholder="+49 170 1234567"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />

              <TapFeedback
                style={[
                  styles.saveProfileBtn,
                  {
                    backgroundColor: colors.goldDim,
                    borderColor: colors.goldBorder,
                  },
                ]}
                onPress={handleSaveProfile}
              >
                <Text
                  style={[styles.saveProfileBtnText, { color: colors.gold }]}
                >
                  {t('settings.saveProfile')}
                </Text>
              </TapFeedback>
            </View>
          </>
        )}

        {/* ================================================================
            SUBMENU 3: NOTIFICATIONS & SECURITY ALERTS ('notifications')
           ================================================================ */}
        {activeSubmenu === 'notifications' && (
          <>
            <Text
              style={[
                styles.sectionHeader,
                { color: colors.textMuted, marginTop: 6 },
              ]}
            >
              {t('notifications.sectionTitle')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <AppIcon name="bell" size={15} color={colors.gold} />
                <Text
                  style={[
                    styles.subLabel,
                    { color: colors.text, marginBottom: 0 },
                  ]}
                >
                  {t('notifications.serverPushGroupTitle')}
                </Text>
              </View>
              <Text style={[styles.profileHint, { color: colors.textMuted }]}>
                {t('notifications.serverPushGroupDesc')}
              </Text>

              {serverPushItems.map((item, idx) => (
                <View
                  key={item.key}
                  style={[
                    styles.notifToggleRow,
                    idx !== serverPushItems.length - 1 && styles.borderBottom,
                    { borderBottomColor: colors.borderSubtle },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.notifTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <Text
                      style={[styles.notifDesc, { color: colors.textMuted }]}
                    >
                      {item.desc}
                    </Text>
                  </View>
                  <FlakeToggle
                    value={!!serverPushPrefs?.[item.key]}
                    onValueChange={(val) =>
                      handleToggleServerPushPref(item.key, val)
                    }
                  />
                </View>
              ))}

              <View
                style={[
                  styles.divider,
                  {
                    backgroundColor: colors.borderSubtle,
                    marginVertical: 14,
                  },
                ]}
              />

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <AppIcon name="shield" size={15} color={colors.gold} />
                <Text
                  style={[
                    styles.subLabel,
                    { color: colors.text, marginBottom: 0 },
                  ]}
                >
                  {t('notifications.localChecksGroupTitle')}
                </Text>
              </View>
              <Text style={[styles.profileHint, { color: colors.textMuted }]}>
                {t('notifications.localChecksGroupDesc')}
              </Text>

              {localCheckItems.map((item, idx) => (
                <View
                  key={item.key}
                  style={[
                    styles.notifToggleRow,
                    idx !== localCheckItems.length - 1 && styles.borderBottom,
                    { borderBottomColor: colors.borderSubtle },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.notifTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <Text
                      style={[styles.notifDesc, { color: colors.textMuted }]}
                    >
                      {item.desc}
                    </Text>
                  </View>
                  <FlakeToggle
                    value={!!localNotifPrefs?.[item.key]}
                    onValueChange={(val) =>
                      handleToggleLocalNotifPref(item.key, val)
                    }
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[
                  styles.saveProfileBtn,
                  {
                    backgroundColor: colors.goldDim,
                    borderColor: colors.goldBorder,
                  },
                ]}
                onPress={handleRunSecurityCheckNow}
                disabled={runningSecurityCheck}
              >
                {runningSecurityCheck ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <Text
                    style={[styles.saveProfileBtnText, { color: colors.gold }]}
                  >
                    {t('notifications.runSecurityCheckNowBtn')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ================================================================
            SUBMENU 4: SESSIONS & SHARING SECURITY ('security')
           ================================================================ */}
        {activeSubmenu === 'security' && (
          <>
            <Text
              style={[
                styles.sectionHeader,
                { color: colors.textMuted, marginTop: 6 },
              ]}
            >
              {t('settings.sessionsSection')} ({sessions.length})
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              {loadingSessions ? (
                <View style={{ paddingVertical: 4 }}>
                  <SessionCardSkeleton />
                  <SessionCardSkeleton />
                </View>
              ) : sessions.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {t('settings.noSessions')}
                </Text>
              ) : (
                sessions.map((s, idx) => {
                  const isCurrent = s.is_current;
                  const info = s.device_info || 'Device';
                  const isPhone =
                    info.toLowerCase().includes('phone') ||
                    info.toLowerCase().includes('ios') ||
                    info.toLowerCase().includes('android');

                  return (
                    <View
                      key={s.id || idx}
                      style={[
                        styles.sessionItem,
                        idx !== sessions.length - 1 && styles.borderBottom,
                        { borderBottomColor: colors.borderSubtle },
                      ]}
                    >
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <View style={styles.sessionHeaderRow}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <AppIcon
                              name={isPhone ? 'share' : 'server'}
                              size={14}
                              color={colors.gold}
                            />
                            <Text
                              style={[
                                styles.sessionDevice,
                                { color: colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {info}
                            </Text>
                          </View>
                          {isCurrent && (
                            <View
                              style={[
                                styles.currentDeviceBadge,
                                {
                                  backgroundColor: colors.greenDim,
                                  borderColor: colors.greenBorder,
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.greenPulseDot,
                                  { backgroundColor: colors.green },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.currentDeviceText,
                                  { color: colors.green },
                                ]}
                              >
                                {t('settings.currentDevice')}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.sessionIp,
                            { color: colors.textMuted },
                          ]}
                        >
                          IP: {s.ip_address || 'Local'}
                        </Text>
                      </View>
                      {!isCurrent ? (
                        <TouchableOpacity
                          onPress={() => handleTerminateSession(s.id)}
                        >
                          <Text
                            style={[styles.removeText, { color: colors.red }]}
                          >
                            {t('settings.terminate')}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View
                          style={[
                            styles.activeNowContainer,
                            { backgroundColor: colors.goldDim },
                          ]}
                        >
                          <Text
                            style={[
                              styles.activeNowText,
                              { color: colors.gold },
                            ]}
                          >
                            {t('settings.activeNow')}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            {/* Sharing & Restrictions */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
              {t('settings.securitySection')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <Text
                style={[styles.subLabel, { color: colors.textSecondary }]}
              >
                {t('settings.whoCanSend')}
              </Text>
              <View style={styles.shareModeContainer}>
                {['only_me', 'whitelist', 'all'].map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.shareModeBtn,
                      {
                        backgroundColor: colors.cardHover,
                        borderColor: colors.cardBorder,
                      },
                      currentShareMode === mode && {
                        backgroundColor: colors.goldDim,
                        borderColor: colors.gold,
                      },
                    ]}
                    onPress={() => handleShareModeChange(mode)}
                  >
                    <Text
                      style={[
                        styles.shareModeText,
                        { color: colors.textMuted },
                        currentShareMode === mode && {
                          color: colors.gold,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {mode === 'only_me'
                        ? t('settings.onlyMe')
                        : mode === 'whitelist'
                        ? t('settings.whitelist')
                        : t('settings.anyone')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {currentShareMode === 'whitelist' && (
                <>
                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: colors.borderSubtle },
                    ]}
                  />
                  <View style={styles.recipientHeader}>
                    <Text
                      style={[styles.subLabel, { color: colors.textSecondary }]}
                    >
                      {t('settings.allowedRecipients')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (isOfflineMode) {
                          toast.warn(
                            t('offline.actionRequiresOnlineTitle'),
                            t('offline.actionRequiresOnlineMsg')
                          );
                          return;
                        }
                        setSearchModalVisible(true);
                      }}
                    >
                      <Text style={[styles.addBtn, { color: colors.gold }]}>
                        {t('settings.addRecipient')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {loadingRestrictions ? (
                    <View
                      style={{ paddingVertical: 10, paddingHorizontal: 4 }}
                    >
                      <SkeletonItem
                        width="75%"
                        height={16}
                        borderRadius={4}
                        style={{ marginBottom: 8 }}
                      />
                      <SkeletonItem width="55%" height={16} borderRadius={4} />
                    </View>
                  ) : restrictions.length === 0 ? (
                    <Text
                      style={[styles.emptyText, { color: colors.textMuted }]}
                    >
                      {t('settings.noRecipients')}
                    </Text>
                  ) : (
                    restrictions.map((r, idx) => (
                      <View
                        key={r.id || idx}
                        style={[
                          styles.recipientItem,
                          idx !== restrictions.length - 1 &&
                            styles.borderBottom,
                          { borderBottomColor: colors.borderSubtle },
                        ]}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <AppIcon name="user" size={13} color={colors.gold} />
                          <Text
                            style={[
                              styles.recipientName,
                              { color: colors.text },
                            ]}
                          >
                            {r.recipient_username || r.username}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            handleRemoveRestriction(
                              r.recipient_username || r.username
                            )
                          }
                        >
                          <Text
                            style={[styles.removeText, { color: colors.red }]}
                          >
                            {t('delete')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </>
              )}
            </View>
          </>
        )}

        {/* ================================================================
            SUBMENU 5: APPEARANCE, LANGUAGE & FORMAT ('appearance')
           ================================================================ */}
        {activeSubmenu === 'appearance' && (
          <>
            <Text
              style={[
                styles.sectionHeader,
                { color: colors.textMuted, marginTop: 6 },
              ]}
            >
              {t('settings.themeSection')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              {[
                {
                  mode: 'system',
                  label: t('settings.themeSystem'),
                  icon: 'gear',
                },
                { mode: 'dark', label: t('settings.themeDark'), icon: 'moon' },
                { mode: 'light', label: t('settings.themeLight'), icon: 'sun' },
              ].map((opt, idx) => (
                <TouchableOpacity
                  key={opt.mode}
                  style={[
                    styles.langItem,
                    idx !== 2 && styles.borderBottom,
                    { borderBottomColor: colors.borderSubtle },
                  ]}
                  onPress={() => setThemeMode(opt.mode)}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <AppIcon
                      name={opt.icon}
                      size={16}
                      color={
                        themeMode === opt.mode
                          ? colors.gold
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.langText,
                        {
                          color:
                            themeMode === opt.mode
                              ? colors.gold
                              : colors.textSecondary,
                        },
                        themeMode === opt.mode && { fontWeight: '700' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </View>
                  {themeMode === opt.mode && (
                    <AppIcon name="check" size={16} color={colors.gold} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Language Section */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
              {t('settings.languageSection')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              {languages.map((lang, index) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langItem,
                    index !== languages.length - 1 && styles.borderBottom,
                    { borderBottomColor: colors.borderSubtle },
                  ]}
                  onPress={() => handleLanguageChange(lang.code)}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <View
                      style={[
                        styles.langBadge,
                        {
                          backgroundColor:
                            locale === lang.code
                              ? colors.goldDim
                              : colors.cardHover,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.langBadgeText,
                          {
                            color:
                              locale === lang.code
                                ? colors.gold
                                : colors.textMuted,
                          },
                        ]}
                      >
                        {lang.badge}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.langText,
                        {
                          color:
                            locale === lang.code
                              ? colors.gold
                              : colors.textSecondary,
                        },
                        locale === lang.code && styles.langSelected,
                      ]}
                    >
                      {lang.label}
                    </Text>
                  </View>
                  {locale === lang.code && (
                    <AppIcon name="check" size={16} color={colors.gold} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Date Format Section */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
              {t('settings.dateFormatSection')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              {dateFormats.map((fmt, index) => (
                <TouchableOpacity
                  key={fmt.code}
                  style={[
                    styles.langItem,
                    index !== dateFormats.length - 1 && styles.borderBottom,
                    { borderBottomColor: colors.borderSubtle },
                  ]}
                  onPress={() => handleDateFormatChange(fmt.code)}
                >
                  <Text
                    style={[
                      styles.langText,
                      {
                        color:
                          currentDateFormat === fmt.code
                            ? colors.gold
                            : colors.textSecondary,
                      },
                      currentDateFormat === fmt.code && styles.langSelected,
                    ]}
                  >
                    {fmt.label}
                  </Text>
                  {currentDateFormat === fmt.code && (
                    <AppIcon name="check" size={16} color={colors.gold} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ================================================================
            SUBMENU 6: DATA, TOOLS & LEGAL ('data')
           ================================================================ */}
        {activeSubmenu === 'data' && (
          <>
            <Text
              style={[
                styles.sectionHeader,
                { color: colors.textMuted, marginTop: 6 },
              ]}
            >
              {t('settings.shortcutsSection')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <TouchableOpacity
                style={styles.dataItem}
                onPress={() => navigation.navigate('Authenticator')}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name="totp" size={16} color={colors.gold} />
                  <Text
                    style={[styles.dataItemText, { color: colors.text }]}
                  >
                    {t('settings.authenticatorShortcut')}
                  </Text>
                </View>
              </TouchableOpacity>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.borderSubtle },
                ]}
              />
              <TouchableOpacity
                style={styles.dataItem}
                onPress={() => navigation.navigate('Logs')}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name="logs" size={16} color={colors.gold} />
                  <Text
                    style={[styles.dataItemText, { color: colors.text }]}
                  >
                    {t('settings.logsShortcut')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Data & Sharing Mode */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
              {t('settings.dataSection')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <TouchableOpacity
                style={styles.dataItem}
                onPress={() =>
                  navigation.navigate('ShareImport', { mode: 'import' })
                }
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name="share" size={15} color={colors.gold} />
                  <Text
                    style={[styles.dataItemText, { color: colors.text }]}
                  >
                    {t('settings.importDevice')}
                  </Text>
                </View>
              </TouchableOpacity>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.borderSubtle },
                ]}
              />
              <TouchableOpacity
                style={styles.dataItem}
                onPress={() =>
                  navigation.navigate('ShareImport', { mode: 'export' })
                }
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name="share" size={15} color={colors.gold} />
                  <Text
                    style={[styles.dataItemText, { color: colors.text }]}
                  >
                    {t('settings.exportDevice')}
                  </Text>
                </View>
              </TouchableOpacity>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.borderSubtle },
                ]}
              />
              <TouchableOpacity
                style={styles.dataItem}
                onPress={() =>
                  navigation.navigate('ShareImport', { mode: 'share' })
                }
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name="user" size={15} color={colors.gold} />
                  <Text
                    style={[styles.dataItemText, { color: colors.text }]}
                  >
                    {t('settings.shareLogins')}
                  </Text>
                </View>
              </TouchableOpacity>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.borderSubtle },
                ]}
              />
              <TouchableOpacity
                style={styles.dataItem}
                onPress={handleClearIconCache}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name="image" size={15} color={colors.gold} />
                  <Text
                    style={[styles.dataItemText, { color: colors.text }]}
                  >
                    {t('settings.clearIconCache')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Legal & Privacy Section */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
              {t('settings.legalSection')}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <TouchableOpacity
                style={styles.dataItem}
                onPress={() =>
                  Linking.openURL('https://flakesecure.snowystudio.dev/legal')
                }
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name="shield" size={15} color={colors.gold} />
                  <Text
                    style={[styles.dataItemText, { color: colors.text }]}
                  >
                    {t('settings.privacyPolicy')}
                  </Text>
                </View>
              </TouchableOpacity>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.borderSubtle },
                ]}
              />
              <TouchableOpacity
                style={styles.dataItem}
                onPress={() =>
                  Linking.openURL('https://flakesecure.snowystudio.dev/imprint')
                }
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name="logs" size={15} color={colors.gold} />
                  <Text
                    style={[styles.dataItemText, { color: colors.text }]}
                  >
                    {t('settings.imprint')}
                  </Text>
                </View>
              </TouchableOpacity>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.borderSubtle },
                ]}
              />
              <TouchableOpacity
                style={styles.dataItem}
                onPress={() =>
                  Linking.openURL('https://flakesecure.snowystudio.dev/terms')
                }
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name="logs" size={15} color={colors.gold} />
                  <Text
                    style={[styles.dataItemText, { color: colors.text }]}
                  >
                    {t('settings.termsOfService')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* User Search Modal */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.modalCard,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('settings.addRecipient')}
              </Text>
              <TouchableOpacity onPress={() => setSearchModalVisible(false)}>
                <AppIcon name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                placeholder="Username eingeben..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[
                  styles.searchBtn,
                  {
                    backgroundColor: colors.goldDim,
                    borderColor: colors.goldBorder,
                  },
                ]}
                onPress={handleSearchUsers}
              >
                <AppIcon name="scan" size={16} color={colors.gold} />
              </TouchableOpacity>
            </View>

            {searching ? (
              <ActivityIndicator
                color={colors.gold}
                style={{ marginTop: 20 }}
              />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.searchResultItem,
                      { borderBottomColor: colors.borderSubtle },
                    ]}
                    onPress={() => handleAddRestriction(item.username)}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <AppIcon name="user" size={14} color={colors.gold} />
                      <Text
                        style={[
                          styles.searchResultText,
                          { color: colors.text },
                        ]}
                      >
                        {item.username}
                      </Text>
                    </View>
                    <Text
                      style={[styles.searchResultAdd, { color: colors.gold }]}
                    >
                      + Hinzufügen
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  searchQuery.length > 0 && !searching ? (
                    <Text
                      style={[styles.emptyText, { color: colors.textMuted }]}
                    >
                      Keine Benutzer gefunden
                    </Text>
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
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
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
    letterSpacing: 1,
    marginTop: 22,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  menuCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextCol: {
    flex: 1,
    minWidth: 0,
  },
  menuRowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuRowSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  menuBadgePill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  menuBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  card: {
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  offlinePillText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  syncVaultBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  syncVaultText: {
    fontSize: 13,
    fontWeight: '700',
  },
  restoreVaultBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  restoreVaultText: {
    fontSize: 13,
    fontWeight: '600',
  },
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
  },
  autofillTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  autofillIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autofillCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  autofillStatusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  autofillStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  autofillInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  autofillInfoText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  autofillActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  autofillActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  autofillActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  notifToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  notifDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  langItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  langBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  langBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  langText: {
    fontSize: 13,
    fontWeight: '500',
  },
  langSelected: {
    fontWeight: '700',
  },
  borderBottom: {
    borderBottomWidth: 1,
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
  },
  currentDeviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 4,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  currentDeviceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  activeNowContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeNowText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sessionIp: {
    fontSize: 11,
  },
  profileHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  profileInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  saveProfileBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  saveProfileBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  shareModeContainer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  shareModeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  shareModeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  recipientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addBtn: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12,
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
    fontSize: 13,
    fontWeight: '500',
  },
  removeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dataItem: {
    paddingVertical: 8,
  },
  dataItemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dangerBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dangerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  searchBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchResultText: {
    fontSize: 13,
    fontWeight: '500',
  },
  searchResultAdd: {
    fontSize: 12,
    fontWeight: '700',
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  aboutLogoContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  aboutSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '58%',
    textAlign: 'right',
  },
  footerBrand: {
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 8,
  },
  footerBrandText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
