/**
 * ============================================================================
 * FlakeSecure Mobile App - HomeScreen v2.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. USER STATUS & HEADER:
 *    - Displays active logged-in user indicator with quick profile access.
 *    - Renders top announcement banners and offline connectivity alerts.
 * 
 * 2. QUICK ACTION BAR:
 *    - Instant navigation shortcuts: Scan QR, Authenticator 2FA, Activity Logs, Add Login.
 * 
 * 3. CATEGORIZATION & FILTERING:
 *    - Horizontally scrollable category filter chips with live credential counts.
 *    - Custom category creation modal and long-press deletion.
 *    - SVG geometric category icons (zero emojis).
 * 
 * 4. CREDENTIAL LIST RENDERING:
 *    - Displays saved domain credentials with security badges (hidden, expiring, category tag).
 *    - Tap to view/edit with biometric gate, swipe/button to delete.
 * ============================================================================
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { getAllCredentials, deleteCredentials, getCategories, saveCategory, deleteCategory } from '../utils/storage';
import { getVault } from '../utils/api';
import { syncVaultFromServer } from '../utils/vault';
import FaviconImage from '../components/FaviconImage';
import { CredentialCardSkeleton } from '../components/Skeleton';
import { TapFeedback } from '../components/TapFeedback';
import { CategoryIcon, AppIcon, AVAILABLE_CATEGORY_ICONS } from '../components/CategoryIcons';

export default function HomeScreen({ navigation, bannerAnnouncements = [], onDismissBanner = null, isOffline = false }) {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { colors } = useTheme();

  const [credentials, setCredentials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('tag');

  // Cloud Vault Pull Prompt directly after login
  const [showVaultPullModal, setShowVaultPullModal] = useState(false);
  const [isPullingVault, setIsPullingVault] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const pendingCheck = await AsyncStorage.getItem('pending_vault_pull_check');
        if (pendingCheck === 'true') {
          await AsyncStorage.removeItem('pending_vault_pull_check');
          const res = await getVault();
          if (res && res.vault && res.vault.encrypted_blob) {
            setShowVaultPullModal(true);
          }
        }
      } catch (err) {
        console.log('[Home] Vault pull prompt check error:', err.message);
      }
    })();
  }, []);

  const handleConfirmPullVault = async () => {
    setIsPullingVault(true);
    try {
      const saved = await SecureStore.getItemAsync('auth_credentials');
      if (!saved) {
        setShowVaultPullModal(false);
        setIsPullingVault(false);
        return;
      }
      const { password, identifier, email } = JSON.parse(saved);
      const success = await syncVaultFromServer(password, identifier, email);
      if (success) {
        await loadData();
        setShowVaultPullModal(false);
        Alert.alert(t('common.success') || 'Erfolg', t('vaultPrompt.pullSuccess') || 'Deine gespeicherten Logindaten wurden erfolgreich geladen!');
      } else {
        setShowVaultPullModal(false);
        Alert.alert(t('error') || 'Fehler', t('vaultPrompt.pullFailed') || 'Zugangsdaten konnten nicht geladen werden.');
      }
    } catch (e) {
      console.log('[Home] Vault pull error:', e.message);
      setShowVaultPullModal(false);
    } finally {
      setIsPullingVault(false);
    }
  };

  const handleDeclinePullVault = () => {
    setShowVaultPullModal(false);
  };

  const loadData = async () => {
    try {
      const [allCreds, allCats] = await Promise.all([
        getAllCredentials(),
        getCategories(),
      ]);
      setCredentials(allCreds);
      setCategories(allCats);
    } catch (e) {
      console.log('Failed to load data', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteDomain = (domain) => {
    Alert.alert(
      t('home.deleteConfirmTitle'),
      t('home.deleteDomainConfirm', { domain }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteCredentials(domain);
            loadData();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = (domain, account) => {
    const displayName = account.name || (account.hidden ? t('credentials.sharedAccount') : account.username);
    Alert.alert(
      t('home.deleteConfirmTitle'),
      t('home.deleteAccountConfirm', { name: displayName }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteCredentials(domain, account.id);
            loadData();
          },
        },
      ]
    );
  };

  const handleDelete = handleDeleteDomain;

  const handleCreateCategory = async () => {
    const cleanName = newCategoryName.trim();
    if (!cleanName) {
      Alert.alert(t('error'), 'Please enter a category name');
      return;
    }

    try {
      const updatedCats = await saveCategory({ name: cleanName, icon: newCategoryIcon });
      setCategories(updatedCats);
      const created = updatedCats.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
      if (created) {
        setSelectedFilter(created.id);
      }
      setNewCategoryName('');
      setNewCategoryIcon('tag');
      setShowCategoryModal(false);
    } catch (e) {
      Alert.alert(t('error'), 'Failed to create category');
    }
  };

  const handleCategoryLongPress = (cat) => {
    if (cat.isDefault) return;
    const displayName = cat.name;
    Alert.alert(
      t('categories.deleteCategoryConfirm'),
      t('categories.deleteCategoryMsg', { name: displayName }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteCategory(cat.id);
            setCategories(updated);
            if (selectedFilter === cat.id) {
              setSelectedFilter('all');
            }
          },
        },
      ]
    );
  };

  const getPriorityTheme = useCallback((priority = 0) => {
    const p = Number(priority) || 0;
    if (p >= 50) {
      return {
        color: colors.red,
        bg: colors.redDim,
        border: colors.redBorder,
        iconName: 'alert',
      };
    } else if (p >= 10) {
      return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.16)',
        border: 'rgba(245, 158, 11, 0.55)',
        iconName: 'alert',
      };
    } else {
      return {
        color: colors.gold,
        bg: colors.goldDim,
        border: colors.goldBorder,
        iconName: 'info',
      };
    }
  }, [colors]);

  const getCategoryInfo = (categoryId) => {
    if (!categoryId) return null;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return null;
    return {
      name: cat.name,
      displayName: cat.isDefault ? t(`categories.${cat.id}`) || cat.name : cat.name,
      icon: cat.icon || 'tag',
    };
  };

  const filteredCredentials = credentials.filter((item) => {
    if (selectedFilter === 'all') return true;
    return item.category === selectedFilter;
  });

  const groupedDomains = useMemo(() => {
    const map = new Map();
    for (const item of filteredCredentials) {
      if (!map.has(item.domain)) {
        map.set(item.domain, []);
      }
      map.get(item.domain).push(item);
    }
    return Array.from(map.entries()).map(([domain, accounts]) => ({
      domain,
      accounts,
    }));
  }, [filteredCredentials]);

  const getCategoryCount = (categoryId) => {
    if (categoryId === 'all') return credentials.length;
    return credentials.filter((c) => c.category === categoryId).length;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <AppIcon name="snowflake" size={22} color={colors.gold} style={{ marginRight: 6 }} />
          <Text style={[styles.brandTitle, { color: colors.text }]}>
            Flake<Text style={{ color: colors.gold }}>Secure</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.userBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.7}
        >
          <View style={[styles.userDot, { backgroundColor: colors.green }]} />
          <Text style={[styles.userBadgeText, { color: colors.text }]} numberOfLines={1}>
            {user?.username || t('common.account')}
          </Text>
          <AppIcon name="gear" size={13} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {isOffline && (
        <View style={styles.offlineBox}>
          <AppIcon name="wifiOff" size={14} color="#ffb340" style={{ marginRight: 6 }} />
          <Text style={styles.offlineText}>{t('common.offlineNotice')}</Text>
        </View>
      )}

      {bannerAnnouncements.map((banner) => {
        const theme = getPriorityTheme(banner.priority);
        return (
          <View
            key={banner.id}
            style={[
              styles.announcementBanner,
              {
                backgroundColor: theme.bg,
                borderColor: theme.border,
              },
            ]}
          >
            <AppIcon name={theme.iconName} size={16} color={theme.color} style={{ marginRight: 8 }} />
            <Text style={[styles.announcementText, { color: colors.text }]}>{banner.message}</Text>
            <TouchableOpacity
              style={styles.announcementCloseBtn}
              onPress={() => onDismissBanner && onDismissBanner(banner.id, banner.display)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <AppIcon name="close" size={12} color={theme.color} />
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Hero Scan Action Button */}
      <TapFeedback
        style={styles.heroScanBtn}
        onPress={() => navigation.navigate('Scan')}
      >
        <LinearGradient
          colors={colors.goldGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroScanGradient}
        >
          <View style={[styles.heroScanIconBg, { backgroundColor: 'rgba(255, 255, 255, 0.22)' }]}>
            <AppIcon name="scan" size={22} color="#ffffff" />
          </View>
          <View style={styles.heroScanInfo}>
            <Text style={[styles.heroScanTitle, { color: '#ffffff' }]}>{t('home.scanQr')}</Text>
            <Text style={[styles.heroScanSubtitle, { color: 'rgba(255, 255, 255, 0.85)' }]}>{t('home.scanQrSub')}</Text>
          </View>
          <Text style={[styles.heroScanArrow, { color: '#ffffff' }]}>→</Text>
        </LinearGradient>
      </TapFeedback>

      {/* Quick Action Navigation Bar */}
      <View style={styles.quickBar}>
        <TapFeedback
          style={[styles.quickBarItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => navigation.navigate('Authenticator')}
        >
          <View style={[styles.quickBarIconCircle, { backgroundColor: colors.goldDim }]}>
            <AppIcon name="totp" size={18} color={colors.gold} />
          </View>
          <Text style={[styles.quickBarLabel, { color: colors.textSecondary }]}>{t('home.quick2fa')}</Text>
        </TapFeedback>

        <TapFeedback
          style={[styles.quickBarItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => navigation.navigate('Logs')}
        >
          <View style={[styles.quickBarIconCircle, { backgroundColor: colors.goldDim }]}>
            <AppIcon name="logs" size={18} color={colors.gold} />
          </View>
          <Text style={[styles.quickBarLabel, { color: colors.textSecondary }]}>{t('home.quickLogs')}</Text>
        </TapFeedback>

        <TapFeedback
          style={[styles.quickBarItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => navigation.navigate('Credentials')}
        >
          <View style={[styles.quickBarIconCircle, { backgroundColor: colors.goldDim }]}>
            <AppIcon name="plus" size={18} color={colors.gold} />
          </View>
          <Text style={[styles.quickBarLabel, { color: colors.textSecondary }]}>{t('home.quickNew')}</Text>
        </TapFeedback>

        <TapFeedback
          style={[styles.quickBarItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => navigation.navigate('ShareImport', { mode: 'share' })}
        >
          <View style={[styles.quickBarIconCircle, { backgroundColor: colors.goldDim }]}>
            <AppIcon name="share" size={18} color={colors.gold} />
          </View>
          <Text style={[styles.quickBarLabel, { color: colors.textSecondary }]}>{t('home.quickShare')}</Text>
        </TapFeedback>
      </View>

      {/* Categories Filter Strip */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              selectedFilter === 'all' && { backgroundColor: colors.gold, borderColor: colors.gold },
            ]}
            onPress={() => setSelectedFilter('all')}
            activeOpacity={0.7}
          >
            <AppIcon
              name="snowflake"
              size={14}
              color={selectedFilter === 'all' ? '#ffffff' : colors.gold}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: colors.textSecondary },
                selectedFilter === 'all' && { color: '#ffffff', fontWeight: '700' },
              ]}
            >
              {t('categories.all')}
            </Text>
            <View
              style={[
                styles.filterCountBadge,
                { backgroundColor: selectedFilter === 'all' ? (colors.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)') : colors.borderSubtle },
              ]}
            >
              <Text
                style={[
                  styles.filterCountText,
                  { color: selectedFilter === 'all' ? '#ffffff' : colors.textMuted },
                ]}
              >
                {getCategoryCount('all')}
              </Text>
            </View>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isSelected = selectedFilter === cat.id;
            const displayName = cat.isDefault ? t(`categories.${cat.id}`) || cat.name : cat.name;
            const count = getCategoryCount(cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  isSelected && { backgroundColor: colors.gold, borderColor: colors.gold },
                ]}
                onPress={() => setSelectedFilter(cat.id)}
                onLongPress={() => handleCategoryLongPress(cat)}
                activeOpacity={0.7}
              >
                <CategoryIcon
                  name={cat.icon || 'tag'}
                  size={13}
                  color={isSelected ? '#ffffff' : colors.gold}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: colors.textSecondary },
                    isSelected && { color: '#ffffff', fontWeight: '700' },
                  ]}
                >
                  {displayName}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.filterCountBadge,
                      { backgroundColor: isSelected ? (colors.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)') : colors.borderSubtle },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterCountText,
                        { color: isSelected ? '#ffffff' : colors.textMuted },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.addCategoryChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.7}
          >
            <AppIcon name="plus" size={13} color={colors.gold} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('home.savedCredentials')}
          <Text style={[styles.count, { color: colors.textMuted }]}> ({filteredCredentials.length})</Text>
        </Text>
      </View>

      {/* Credentials List */}
      {isLoadingData ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
          <CredentialCardSkeleton />
          <CredentialCardSkeleton />
          <CredentialCardSkeleton />
        </View>
      ) : credentials.length === 0 ? (
        <View style={styles.empty}>
          <AppIcon name="lock" size={44} color={colors.gold} style={{ marginBottom: 14 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('home.noEntries')}</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('home.noEntriesText')}</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.goldDim, borderColor: colors.goldBorder }]}
            onPress={() => navigation.navigate('Credentials')}
          >
            <Text style={[styles.addButtonText, { color: colors.gold }]}>{t('home.addButton')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.restoreVaultEmptyBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => navigation.navigate('VaultTransfer', { mode: 'check_or_receive' })}
          >
            <Text style={[styles.restoreVaultEmptyText, { color: colors.textSecondary }]}>
              {t('settings.restoreVault') || 'Restore from Cloud Vault'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : filteredCredentials.length === 0 ? (
        <View style={styles.empty}>
          <AppIcon name="folder" size={44} color={colors.gold} style={{ marginBottom: 14 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('home.noEntriesInCategory')}</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.goldDim, borderColor: colors.goldBorder }]}
            onPress={() => navigation.navigate('Credentials')}
          >
            <Text style={[styles.addButtonText, { color: colors.gold }]}>{t('home.addButton')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groupedDomains}
          keyExtractor={(item) => item.domain}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
          contentContainerStyle={styles.list}
          renderItem={({ item: group }) => {
            const accountCount = group.accounts.length;
            const countText = accountCount === 1
              ? t('home.accountSingle')
              : t('home.accountsPlural', { count: accountCount });

            return (
              <View style={[styles.domainGroupCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {/* Domain Group Header */}
                <View style={[styles.domainGroupHeader, { borderBottomColor: colors.borderSubtle }]}>
                  <View style={styles.domainGroupHeaderLeft}>
                    <FaviconImage
                      domain={group.domain}
                      size={30}
                      borderRadius={6}
                      style={{ marginRight: 10 }}
                    />
                    <View style={styles.domainGroupTitleCol}>
                      <Text style={[styles.domainGroupTitle, { color: colors.text }]} numberOfLines={1}>
                        {group.domain}
                      </Text>
                      <Text style={[styles.domainGroupSubtitle, { color: colors.textMuted }]}>
                        {countText}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.domainGroupHeaderRight}>
                    <TouchableOpacity
                      style={[styles.groupActionBtn, { backgroundColor: colors.goldDim, borderColor: colors.goldBorder }]}
                      onPress={() => navigation.navigate('Credentials', { prefillDomain: group.domain })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={t('home.addAccountForDomain')}
                    >
                      <AppIcon name="plus" size={13} color={colors.gold} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.groupActionBtn, { backgroundColor: colors.cardBg, borderColor: colors.borderSubtle }]}
                      onPress={() => handleDeleteDomain(group.domain)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <AppIcon name="close" size={13} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Accounts under this domain */}
                <View style={styles.domainAccountsList}>
                  {group.accounts.map((account, index) => {
                    const isLast = index === group.accounts.length - 1;
                    const catInfo = getCategoryInfo(account.category);
                    const displayName = account.name
                      ? account.name
                      : (account.hidden ? t('credentials.sharedAccount') : account.username);
                    const showUsernameSub = account.name && !account.hidden;

                    return (
                      <TapFeedback
                        key={account.id || `${group.domain}_${index}`}
                        style={[
                          styles.accountItemRow,
                          !isLast && [styles.accountItemBorder, { borderBottomColor: colors.borderSubtle }]
                        ]}
                        onPress={() => navigation.navigate('ViewCredential', { domain: group.domain, id: account.id })}
                      >
                        <View style={[styles.accountAvatarCircle, { backgroundColor: colors.goldDim }]}>
                          <AppIcon
                            name={account.hidden ? 'lock' : 'user'}
                            size={14}
                            color={account.hidden ? colors.gold : colors.textSecondary}
                          />
                        </View>

                        <View style={styles.accountItemInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={[styles.accountItemName, { color: colors.text }]} numberOfLines={1}>
                              {displayName}
                            </Text>
                            {account.hasNote && (
                              <View style={[styles.noteBadge, { backgroundColor: colors.goldDim, borderColor: colors.goldBorder }]}>
                                <AppIcon name="note" size={10} color={colors.gold} />
                              </View>
                            )}
                            {account.hidden && (
                              <View style={[styles.hiddenBadge, { backgroundColor: colors.goldDim, borderColor: colors.goldBorder }]}>
                                <AppIcon name="lock" size={9} color={colors.gold} />
                                <Text style={[styles.hiddenBadgeText, { color: colors.gold }]}>
                                  {t('viewCredential.hidden') || 'Geschützt'}
                                </Text>
                              </View>
                            )}
                            {catInfo && (
                              <View style={[styles.categoryBadge, { backgroundColor: colors.goldDim, borderColor: colors.goldBorder }]}>
                                <CategoryIcon name={catInfo.icon} size={10} color={colors.gold} />
                                <Text style={[styles.categoryBadgeText, { color: colors.gold }]}>
                                  {catInfo.displayName}
                                </Text>
                              </View>
                            )}
                          </View>

                          {showUsernameSub && (
                            <Text style={[styles.accountItemUsername, { color: colors.textSecondary }]} numberOfLines={1}>
                              {account.username}
                            </Text>
                          )}

                          {account.expiresAt && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <AppIcon name="clock" size={10} color={colors.red} />
                              <Text style={{ fontSize: 10, color: colors.red }}>
                                Ablauf: {new Date(account.expiresAt).toLocaleDateString()}
                              </Text>
                            </View>
                          )}
                        </View>

                        <TouchableOpacity
                          style={styles.accountDeleteBtn}
                          onPress={() => handleDeleteAccount(group.domain, account)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <AppIcon name="close" size={13} color={colors.textMuted} />
                        </TouchableOpacity>
                      </TapFeedback>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Category Creation Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent={true}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.modalCard, borderColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('categories.newCategory')}</Text>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>{t('categories.categoryName')}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="z.B. Shopping, Uni, Banking"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>{t('categories.categoryIcon')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPickerScroll}>
              {AVAILABLE_CATEGORY_ICONS.map((iconKey) => (
                <TouchableOpacity
                  key={iconKey}
                  style={[
                    styles.iconChoice,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    newCategoryIcon === iconKey && { backgroundColor: colors.goldDim, borderColor: colors.gold, borderWidth: 1.5 },
                  ]}
                  onPress={() => setNewCategoryIcon(iconKey)}
                >
                  <CategoryIcon
                    name={iconKey}
                    size={20}
                    color={newCategoryIcon === iconKey ? colors.gold : colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                }}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleCreateCategory} activeOpacity={0.85}>
                <LinearGradient
                  colors={colors.goldGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalSaveGradient}
                >
                  <Text style={[styles.modalSaveText, { color: '#ffffff' }]}>{t('categories.createCategory')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cloud Vault Pull Prompt Modal directly after Login */}
      <Modal
        visible={showVaultPullModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isPullingVault) setShowVaultPullModal(false);
        }}
      >
        <View style={[styles.vaultModalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.vaultModalCard, { backgroundColor: colors.modalCard, borderColor: colors.goldBorder }]}>
            <View style={[styles.vaultModalIconCircle, { backgroundColor: colors.goldDim, borderColor: colors.goldBorder }]}>
              <AppIcon name="shield" size={30} color={colors.gold} />
            </View>
            <Text style={[styles.vaultModalTitle, { color: colors.text }]}>{t('vaultPrompt.foundTitle') || 'Logindaten verfügbar'}</Text>
            <Text style={[styles.vaultModalDesc, { color: colors.textSecondary }]}>
              {t('vaultPrompt.foundPrompt') || 'Für deinen Account wurden gespeicherte Logindaten im Tresor gefunden. Möchtest du diese jetzt automatisch in die App laden?'}
            </Text>

            {isPullingVault ? (
              <View style={styles.vaultModalLoadingBox}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={[styles.vaultModalLoadingText, { color: colors.gold }]}>
                  {t('vaultPrompt.pulling') || 'Daten werden geladen & entschlüsselt…'}
                </Text>
              </View>
            ) : (
              <View style={styles.vaultModalBtnRow}>
                <TouchableOpacity
                  style={[styles.vaultModalCancelBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  onPress={handleDeclinePullVault}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.vaultModalCancelText, { color: colors.textSecondary }]}>
                    {t('vaultPrompt.skip') || 'Nicht jetzt'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.vaultModalConfirmBtn}
                  onPress={handleConfirmPullVault}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={colors.goldGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.vaultModalConfirmGradient}
                  >
                    <Text style={[styles.vaultModalConfirmText, { color: '#ffffff' }]}>
                      {t('vaultPrompt.pullNow') || 'Jetzt laden'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 160,
    gap: 6,
  },
  userDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  userBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  offlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderColor: 'rgba(255, 149, 0, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  offlineText: {
    color: '#ffb340',
    fontSize: 12,
    fontWeight: '600',
  },
  announcementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  announcementText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  announcementCloseBtn: {
    marginLeft: 8,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroScanBtn: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  heroScanGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  heroScanIconBg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  heroScanInfo: {
    flex: 1,
  },
  heroScanTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  heroScanSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  heroScanArrow: {
    fontSize: 18,
    fontWeight: '700',
  },
  quickBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },
  quickBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 2,
    minHeight: 74,
  },
  quickBarIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 12,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterCountBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  addCategoryChip: {
    borderWidth: 1,
    borderRadius: 8,
    width: 32,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeaderRow: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.05,
  },
  count: {
    fontWeight: '400',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  domainGroupCard: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  domainGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  domainGroupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  domainGroupTitleCol: {
    flex: 1,
  },
  domainGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  domainGroupSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  domainGroupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainAccountsList: {
    paddingVertical: 2,
  },
  accountItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  accountItemBorder: {
    borderBottomWidth: 1,
  },
  accountAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  accountItemInfo: {
    flex: 1,
  },
  accountItemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  accountItemUsername: {
    fontSize: 12,
    marginTop: 1,
  },
  accountDeleteBtn: {
    padding: 6,
    marginLeft: 6,
  },
  hiddenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    gap: 3,
  },
  noteBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  hiddenBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  credItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  credInfo: {
    flex: 1,
  },
  credDomain: {
    fontSize: 15,
    fontWeight: '700',
  },
  credUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    gap: 3,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  credDelete: {
    padding: 8,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  addButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  restoreVaultEmptyBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
  },
  restoreVaultEmptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  iconPickerScroll: {
    marginVertical: 8,
  },
  iconChoice: {
    width: 38,
    height: 38,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
  },
  modalSaveGradient: {
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
  },
  vaultModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  vaultModalCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  vaultModalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  vaultModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  vaultModalDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  vaultModalLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  vaultModalLoadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  vaultModalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  vaultModalCancelBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  vaultModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  vaultModalConfirmBtn: {
    flex: 1.2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  vaultModalConfirmGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultModalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
