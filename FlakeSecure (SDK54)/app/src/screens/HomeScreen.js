/**
 * ============================================================================
 * FlakeSecure Mobile App - HomeScreen v2.1
 * ============================================================================
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
import {
  getAllCredentials,
  deleteCredentials,
  getCategories,
  saveCategory,
  deleteCategory,
  getBankAccounts,
  deleteBankAccount,
  getCards,
  deleteCard,
  getCodes,
  deleteCode,
  CARD_COLOR_THEMES,
  CODE_CATEGORIES,
  formatCardNumber,
  formatIban,
  getCardBrandDisplayName,
  getCardExpiryStatus,
  moveDomainOrder,
  moveDomainAccountOrder,
  moveBankAccountOrder,
  moveCardOrder,
  moveCodeOrder,
} from '../utils/storage';
import { getVault } from '../utils/api';
import { syncVaultFromServer } from '../utils/vault';
import FaviconImage from '../components/FaviconImage';
import { CredentialCardSkeleton } from '../components/Skeleton';
import { TapFeedback } from '../components/TapFeedback';
import {
  CategoryIcon,
  AppIcon,
  AVAILABLE_CATEGORY_ICONS,
} from '../components/CategoryIcons';

export default function HomeScreen({
  navigation,
  route,
  bannerAnnouncements = [],
  onDismissBanner = null,
  isOffline = false,
}) {
  const { user, isOfflineMode } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const toast = useToast();

  const effectiveOffline = !!(isOffline || isOfflineMode);

  const [activeSegment, setActiveSegment] = useState('logins'); // 'logins' | 'cards' | 'codes'
  const [searchQuery, setSearchQuery] = useState('');
  const [isReordering, setIsReordering] = useState(false);

  const [credentials, setCredentials] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [codes, setCodes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedCodeCat, setSelectedCodeCat] = useState('all');
  const [revealedCodeIds, setRevealedCodeIds] = useState({});
  const [revealedIbanIds, setRevealedIbanIds] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('tag');

  // Cloud Vault Pull Prompt directly after login
  const [showVaultPullModal, setShowVaultPullModal] = useState(false);
  const [isPullingVault, setIsPullingVault] = useState(false);

  const clipboardTimerRef = useRef(null);

  useEffect(() => {
    const seg = route?.params?.initialSegment;
    if (seg && ['logins', 'cards', 'codes'].includes(seg)) {
      setActiveSegment(seg);
    }
  }, [route?.params?.initialSegment]);

  useEffect(() => {
    return () => {
      if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
    };
  }, []);

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
        toast.success(
          t('common.success') || 'Erfolg',
          t('vaultPrompt.pullSuccess') ||
            'Deine gespeicherten Logindaten wurden erfolgreich geladen!'
        );
      } else {
        setShowVaultPullModal(false);
        toast.error(
          t('error') || 'Fehler',
          t('vaultPrompt.pullFailed') || 'Zugangsdaten konnten nicht geladen werden.'
        );
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
      const [allCreds, allCats, allBankAccs, allCards, allCodes] =
        await Promise.all([
          getAllCredentials(),
          getCategories(),
          getBankAccounts(),
          getCards(),
          getCodes(),
        ]);
      setCredentials(allCreds);
      setCategories(allCats);
      setBankAccounts(allBankAccs);
      setCards(allCards);
      setCodes(allCodes);
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

  const copyWithAutoClear = async (value, label) => {
    if (!value) return;
    await Clipboard.setStringAsync(String(value));
    toast.success(t('toast.copiedAutoClear', { label }));
    if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
    clipboardTimerRef.current = setTimeout(async () => {
      try {
        await Clipboard.setStringAsync('');
      } catch {}
    }, 45000);
  };

  const requireBiometricAction = async () => {
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHw || !enrolled) return true;
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: t('viewCredential.biometricPrompt') || 'Mit Biometrie entsperren',
      });
      return !!res.success;
    } catch {
      return false;
    }
  };

  const handleToggleRevealCode = async (codeId) => {
    if (revealedCodeIds[codeId]) {
      setRevealedCodeIds((prev) => ({ ...prev, [codeId]: false }));
      return;
    }
    const ok = await requireBiometricAction();
    if (ok) {
      setRevealedCodeIds((prev) => ({ ...prev, [codeId]: true }));
    }
  };

  const handleQuickCopyCode = async (codeItem) => {
    if (!revealedCodeIds[codeItem.id]) {
      const ok = await requireBiometricAction();
      if (!ok) return;
    }
    await copyWithAutoClear(codeItem.code, codeItem.label || t('codes.copyCode'));
  };

  const handleDeleteDomain = (domain) => {
    toast.confirm({
      title: t('home.deleteConfirmTitle'),
      message: t('home.deleteDomainConfirm', { domain }),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      danger: true,
      onConfirm: async () => {
        await deleteCredentials(domain);
        loadData();
        toast.success(t('toast.deleted'));
      },
    });
  };

  const handleDeleteAccount = (domain, account) => {
    const displayName =
      account.name ||
      (account.hidden ? t('credentials.sharedAccount') : account.username);
    toast.confirm({
      title: t('home.deleteConfirmTitle'),
      message: t('home.deleteAccountConfirm', { name: displayName }),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      danger: true,
      onConfirm: async () => {
        await deleteCredentials(domain, account.id);
        loadData();
        toast.success(t('toast.deleted'));
      },
    });
  };

  const handleDeleteCardItem = (card) => {
    toast.confirm({
      title: t('cards.deleteConfirmTitle'),
      message: t('cards.deleteConfirmMsg', { label: card.label || 'Card' }),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      danger: true,
      onConfirm: async () => {
        await deleteCard(card.id);
        loadData();
        toast.success(t('cards.deletedToast'));
      },
    });
  };

  const handleDeleteBankAccountGroup = (group) => {
    if (!group.accountId) return;
    toast.confirm({
      title: t('cards.deleteAccountConfirmTitle'),
      message: t('cards.deleteAccountConfirmMsg', {
        name: group.name || group.bankName || 'Konto',
      }),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      danger: true,
      onConfirm: async () => {
        await deleteBankAccount(group.accountId, { deleteCards: true });
        loadData();
        toast.success(t('cards.accountDeletedToast'));
      },
    });
  };

  const handleToggleRevealIban = async (groupKey) => {
    if (revealedIbanIds[groupKey]) {
      setRevealedIbanIds((prev) => ({ ...prev, [groupKey]: false }));
      return;
    }
    const ok = await requireBiometricAction();
    if (ok) {
      setRevealedIbanIds((prev) => ({ ...prev, [groupKey]: true }));
    }
  };

  const handleQuickCopyIban = async (group) => {
    if (!group.iban) return;
    if (!revealedIbanIds[group.key]) {
      const ok = await requireBiometricAction();
      if (!ok) return;
    }
    await copyWithAutoClear(
      formatIban(group.iban, false),
      t('cards.copyIban') || 'IBAN'
    );
  };

  const handleDeleteCodeItem = (codeItem) => {
    toast.confirm({
      title: t('codes.deleteConfirmTitle'),
      message: t('codes.deleteConfirmMsg', { label: codeItem.label || 'Code' }),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      danger: true,
      onConfirm: async () => {
        await deleteCode(codeItem.id);
        loadData();
        toast.success(t('codes.deletedToast'));
      },
    });
  };

  const handleCreateCategory = async () => {
    const cleanName = newCategoryName.trim();
    if (!cleanName) {
      toast.warn(t('error'), t('viewCredential.allFieldsRequired'));
      return;
    }

    try {
      const updatedCats = await saveCategory({
        name: cleanName,
        icon: newCategoryIcon,
      });
      setCategories(updatedCats);
      const created = updatedCats.find(
        (c) => c.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (created) {
        setSelectedFilter(created.id);
      }
      setNewCategoryName('');
      setNewCategoryIcon('tag');
      setShowCategoryModal(false);
      toast.success(t('toast.saved'));
    } catch (e) {
      toast.error(t('error'), e.message || 'Failed to create category');
    }
  };

  const handleCategoryLongPress = (cat) => {
    if (cat.isDefault) return;
    const displayName = cat.name;
    toast.confirm({
      title: t('categories.deleteCategoryConfirm'),
      message: t('categories.deleteCategoryMsg', { name: displayName }),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      danger: true,
      onConfirm: async () => {
        const updated = await deleteCategory(cat.id);
        setCategories(updated);
        if (selectedFilter === cat.id) {
          setSelectedFilter('all');
        }
      },
    });
  };

  const getPriorityTheme = useCallback(
    (priority = 0) => {
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
    },
    [colors]
  );

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

  const cleanSearch = searchQuery.trim().toLowerCase();

  const filteredCredentials = useMemo(() => {
    return credentials.filter((item) => {
      if (selectedFilter !== 'all' && item.category !== selectedFilter) return false;
      if (!cleanSearch) return true;
      return (
        String(item.domain || '').toLowerCase().includes(cleanSearch) ||
        String(item.name || '').toLowerCase().includes(cleanSearch) ||
        String(item.username || '').toLowerCase().includes(cleanSearch)
      );
    });
  }, [credentials, selectedFilter, cleanSearch]);

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

  const filteredCards = useMemo(() => {
    if (!cleanSearch) return cards;
    return cards.filter((c) => {
      const last4 = String(c.number || '').slice(-4);
      return (
        String(c.label || '').toLowerCase().includes(cleanSearch) ||
        String(c.accountName || '').toLowerCase().includes(cleanSearch) ||
        String(c.issuer || '').toLowerCase().includes(cleanSearch) ||
        String(c.iban || '').toLowerCase().includes(cleanSearch) ||
        String(c.bic || '').toLowerCase().includes(cleanSearch) ||
        String(c.cardholderName || '').toLowerCase().includes(cleanSearch) ||
        String(c.brand || '').toLowerCase().includes(cleanSearch) ||
        last4.includes(cleanSearch)
      );
    });
  }, [cards, cleanSearch]);

  const groupedBankAccounts = useMemo(() => {
    const groupsMap = new Map();

    // 1. Seed from explicit saved Bank Accounts
    for (const acc of bankAccounts) {
      const matchesSearch =
        !cleanSearch ||
        String(acc.name || '').toLowerCase().includes(cleanSearch) ||
        String(acc.bankName || '').toLowerCase().includes(cleanSearch) ||
        String(acc.iban || '').toLowerCase().includes(cleanSearch) ||
        String(acc.bic || '').toLowerCase().includes(cleanSearch) ||
        String(acc.holderName || '').toLowerCase().includes(cleanSearch);

      groupsMap.set(`acc_${acc.id}`, {
        key: `acc_${acc.id}`,
        accountId: acc.id,
        name: acc.name || acc.bankName || t('cards.defaultAccountName'),
        bankName: acc.bankName || '',
        iban: acc.iban || '',
        bic: acc.bic || '',
        holderName: acc.holderName || '',
        hasNote: !!acc.hasNote,
        matchesAccountSearch: matchesSearch,
        cards: [],
      });
    }

    // 2. Attach cards to their matching Bank Account group (or create ad-hoc group)
    for (const card of filteredCards) {
      let targetKey = null;

      if (card.accountId && groupsMap.has(`acc_${card.accountId}`)) {
        targetKey = `acc_${card.accountId}`;
      } else if (card.iban) {
        for (const [k, grp] of groupsMap.entries()) {
          if (grp.iban && grp.iban === card.iban) {
            targetKey = k;
            break;
          }
        }
      }

      if (!targetKey) {
        const adhocKey = card.iban
          ? `iban_${card.iban}`
          : card.accountName
          ? `name_${card.accountName.toLowerCase()}`
          : card.issuer
          ? `issuer_${card.issuer.toLowerCase()}`
          : 'unassigned_cards';

        if (!groupsMap.has(adhocKey)) {
          groupsMap.set(adhocKey, {
            key: adhocKey,
            accountId: card.accountId || null,
            name:
              card.accountName ||
              card.issuer ||
              t('cards.unassignedAccountGroup'),
            bankName: card.issuer || '',
            iban: card.iban || '',
            bic: card.bic || '',
            holderName: card.cardholderName || '',
            hasNote: false,
            matchesAccountSearch: true,
            cards: [],
          });
        }
        targetKey = adhocKey;
      }

      const grp = groupsMap.get(targetKey);
      if (grp) {
        if (!grp.bankName && card.issuer) grp.bankName = card.issuer;
        if (!grp.iban && card.iban) grp.iban = card.iban;
        if (!grp.bic && card.bic) grp.bic = card.bic;
        grp.cards.push(card);
      }
    }

    // Filter out empty bank accounts only when searching and neither account nor cards matched
    return Array.from(groupsMap.values()).filter(
      (grp) => grp.cards.length > 0 || grp.matchesAccountSearch
    );
  }, [bankAccounts, filteredCards, cleanSearch, t]);

  const filteredCodes = useMemo(() => {
    return codes.filter((item) => {
      if (selectedCodeCat !== 'all' && item.codeCategory !== selectedCodeCat) {
        return false;
      }
      if (!cleanSearch) return true;
      return (
        String(item.label || '').toLowerCase().includes(cleanSearch) ||
        String(item.location || '').toLowerCase().includes(cleanSearch) ||
        String(item.codeCategory || '').toLowerCase().includes(cleanSearch)
      );
    });
  }, [codes, selectedCodeCat, cleanSearch]);

  const getCategoryCount = (categoryId) => {
    if (categoryId === 'all') return credentials.length;
    return credentials.filter((c) => c.category === categoryId).length;
  };

  const handleQuickNewPress = () => {
    const typeMap = {
      logins: 'login',
      cards: 'card',
      codes: 'code',
    };
    navigation.navigate('Credentials', { initialType: typeMap[activeSegment] || 'login' });
  };

  const triggerSmoothOrderAnim = () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {}
  };

  const handleMoveDomain = async (groupIdx, direction) => {
    const targetIdx = groupIdx + direction;
    if (targetIdx < 0 || targetIdx >= groupedDomains.length) return;
    const domainA = groupedDomains[groupIdx]?.domain;
    const domainB = groupedDomains[targetIdx]?.domain;
    if (!domainA || !domainB) return;

    triggerSmoothOrderAnim();
    await moveDomainOrder(domainA, domainB);
    await loadData();
  };

  const handleMoveDomainAccount = async (domain, domainAccounts, accIdx, direction) => {
    const targetIdx = accIdx + direction;
    if (targetIdx < 0 || targetIdx >= domainAccounts.length) return;
    const accA = domainAccounts[accIdx];
    const accB = domainAccounts[targetIdx];
    if (!accA?.id || !accB?.id) return;

    triggerSmoothOrderAnim();
    await moveDomainAccountOrder(domain, accA.id, accB.id);
    await loadData();
  };

  const handleMoveBankAccountGroup = async (groupIdx, direction) => {
    const targetIdx = groupIdx + direction;
    if (targetIdx < 0 || targetIdx >= groupedBankAccounts.length) return;
    const grpA = groupedBankAccounts[groupIdx];
    const grpB = groupedBankAccounts[targetIdx];
    if (!grpA || !grpB) return;

    triggerSmoothOrderAnim();
    if (grpA.accountId && grpB.accountId) {
      await moveBankAccountOrder(grpA.accountId, grpB.accountId);
    } else if (grpA.cards?.[0]?.id && grpB.cards?.[0]?.id) {
      await moveCardOrder(grpA.cards[0].id, grpB.cards[0].id);
    }
    await loadData();
  };

  const handleMoveCardInGroup = async (groupCards, cardIdx, direction) => {
    const targetIdx = cardIdx + direction;
    if (targetIdx < 0 || targetIdx >= groupCards.length) return;
    const cardA = groupCards[cardIdx];
    const cardB = groupCards[targetIdx];
    if (!cardA?.id || !cardB?.id) return;

    triggerSmoothOrderAnim();
    await moveCardOrder(cardA.id, cardB.id);
    await loadData();
  };

  const handleMoveCode = async (codeIdx, direction) => {
    const targetIdx = codeIdx + direction;
    if (targetIdx < 0 || targetIdx >= filteredCodes.length) return;
    const codeA = filteredCodes[codeIdx];
    const codeB = filteredCodes[targetIdx];
    if (!codeA?.id || !codeB?.id) return;

    triggerSmoothOrderAnim();
    await moveCodeOrder(codeA.id, codeB.id);
    await loadData();
  };

  const renderReorderControls = (
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
    darkCardOverlay = false
  ) => (
    <View style={styles.reorderControlsRow}>
      <TouchableOpacity
        style={[
          styles.reorderArrowBtn,
          {
            backgroundColor: darkCardOverlay
              ? 'rgba(0,0,0,0.42)'
              : canMoveUp
              ? colors.goldDim
              : colors.cardBg,
            borderColor: darkCardOverlay
              ? canMoveUp
                ? colors.gold
                : 'rgba(255,255,255,0.2)'
              : canMoveUp
              ? colors.goldBorder
              : colors.borderSubtle,
          },
          !canMoveUp && { opacity: 0.35 },
        ]}
        disabled={!canMoveUp}
        onPress={onMoveUp}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <AppIcon
          name="chevronUp"
          size={14}
          color={canMoveUp ? colors.gold : colors.textMuted}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.reorderArrowBtn,
          {
            backgroundColor: darkCardOverlay
              ? 'rgba(0,0,0,0.42)'
              : canMoveDown
              ? colors.goldDim
              : colors.cardBg,
            borderColor: darkCardOverlay
              ? canMoveDown
                ? colors.gold
                : 'rgba(255,255,255,0.2)'
              : canMoveDown
              ? colors.goldBorder
              : colors.borderSubtle,
          },
          !canMoveDown && { opacity: 0.35 },
        ]}
        disabled={!canMoveDown}
        onPress={onMoveDown}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <AppIcon
          name="chevronDown"
          size={14}
          color={canMoveDown ? colors.gold : colors.textMuted}
        />
      </TouchableOpacity>
    </View>
  );

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
          style={[
            styles.userBadge,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.userDot,
              { backgroundColor: effectiveOffline ? '#f59e0b' : colors.green },
            ]}
          />
          <Text style={[styles.userBadgeText, { color: colors.text }]} numberOfLines={1}>
            {user?.username || t('common.account')}
          </Text>
          <AppIcon name="gear" size={13} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {effectiveOffline && (
        <View style={styles.offlineBox}>
          <AppIcon
            name="offline-cloud"
            size={16}
            color="#ffb340"
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.offlineTitleText}>{t('offline.bannerTitle')}</Text>
            <Text style={styles.offlineSubText}>{t('offline.bannerSubtitle')}</Text>
          </View>
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
            <AppIcon
              name={theme.iconName}
              size={16}
              color={theme.color}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.announcementText, { color: colors.text }]}>
              {banner.message}
            </Text>
            <TouchableOpacity
              style={styles.announcementCloseBtn}
              onPress={() =>
                onDismissBanner && onDismissBanner(banner.id, banner.display)
              }
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
          <View
            style={[
              styles.heroScanIconBg,
              { backgroundColor: 'rgba(255, 255, 255, 0.22)' },
            ]}
          >
            <AppIcon name="scan" size={22} color="#ffffff" />
          </View>
          <View style={styles.heroScanInfo}>
            <Text style={[styles.heroScanTitle, { color: '#ffffff' }]}>
              {t('home.scanQr')}
            </Text>
            <Text
              style={[
                styles.heroScanSubtitle,
                { color: 'rgba(255, 255, 255, 0.85)' },
              ]}
            >
              {t('home.scanQrSub')}
            </Text>
          </View>
          <AppIcon name="chevronRight" size={18} color="#ffffff" />
        </LinearGradient>
      </TapFeedback>

      {/* Quick Action Navigation Bar */}
      <View style={styles.quickBar}>
        <TapFeedback
          style={[
            styles.quickBarItem,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={() => navigation.navigate('Authenticator')}
        >
          <View style={[styles.quickBarIconCircle, { backgroundColor: colors.goldDim }]}>
            <AppIcon name="totp" size={18} color={colors.gold} />
          </View>
          <Text style={[styles.quickBarLabel, { color: colors.textSecondary }]}>
            {t('home.quick2fa')}
          </Text>
        </TapFeedback>

        <TapFeedback
          style={[
            styles.quickBarItem,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={() => navigation.navigate('Logs')}
        >
          <View style={[styles.quickBarIconCircle, { backgroundColor: colors.goldDim }]}>
            <AppIcon name="logs" size={18} color={colors.gold} />
          </View>
          <Text style={[styles.quickBarLabel, { color: colors.textSecondary }]}>
            {t('home.quickLogs')}
          </Text>
        </TapFeedback>

        <TapFeedback
          style={[
            styles.quickBarItem,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={handleQuickNewPress}
        >
          <View style={[styles.quickBarIconCircle, { backgroundColor: colors.goldDim }]}>
            <AppIcon name="plus" size={18} color={colors.gold} />
          </View>
          <Text style={[styles.quickBarLabel, { color: colors.textSecondary }]}>
            {t('home.quickNew')}
          </Text>
        </TapFeedback>

        <TapFeedback
          style={[
            styles.quickBarItem,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={() => navigation.navigate('ShareImport', { mode: 'share' })}
        >
          <View style={[styles.quickBarIconCircle, { backgroundColor: colors.goldDim }]}>
            <AppIcon name="share" size={18} color={colors.gold} />
          </View>
          <Text style={[styles.quickBarLabel, { color: colors.textSecondary }]}>
            {t('home.quickShare')}
          </Text>
        </TapFeedback>
      </View>

      {/* 3-Segment Switcher: Logins | Karten | Codes */}
      <View
        style={[
          styles.segmentContainer,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        {[
          {
            key: 'logins',
            label: t('home.segmentLogins') || 'Credentials',
            icon: 'lock',
            count: credentials.length,
            flexWeight: 1.25,
          },
          {
            key: 'cards',
            label: t('cards.segmentTitle') || 'Karten',
            icon: 'card',
            count: cards.length,
            flexWeight: 1,
          },
          {
            key: 'codes',
            label: t('codes.segmentTitle') || 'Codes',
            icon: 'keypad',
            count: codes.length,
            flexWeight: 1,
          },
        ].map((seg) => {
          const isSelected = activeSegment === seg.key;
          return (
            <TouchableOpacity
              key={seg.key}
              style={[
                styles.segmentTab,
                { flex: seg.flexWeight || 1 },
                isSelected && { backgroundColor: colors.gold },
              ]}
              onPress={() => setActiveSegment(seg.key)}
              activeOpacity={0.8}
            >
              <CategoryIcon
                name={seg.icon}
                size={14}
                color={isSelected ? '#ffffff' : colors.gold}
              />
              <Text
                style={[
                  styles.segmentTabText,
                  { color: isSelected ? '#ffffff' : colors.textSecondary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {seg.label}
              </Text>
              <View
                style={[
                  styles.segmentCountPill,
                  {
                    backgroundColor: isSelected
                      ? 'rgba(255,255,255,0.24)'
                      : colors.borderSubtle,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentCountText,
                    { color: isSelected ? '#ffffff' : colors.textMuted },
                  ]}
                >
                  {seg.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search Bar + Reorder Toggle */}
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <AppIcon name="search" size={15} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('home.searchPlaceholder') || 'Tresor durchsuchen…'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <AppIcon name="close" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.reorderToggleBtn,
            {
              backgroundColor: isReordering ? colors.gold : colors.card,
              borderColor: isReordering ? colors.gold : colors.cardBorder,
            },
          ]}
          onPress={() => {
            triggerSmoothOrderAnim();
            setIsReordering((prev) => !prev);
          }}
          activeOpacity={0.8}
        >
          <AppIcon
            name={isReordering ? 'check' : 'reorder'}
            size={15}
            color={isReordering ? '#ffffff' : colors.gold}
          />
          <Text
            style={[
              styles.reorderToggleText,
              { color: isReordering ? '#ffffff' : colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {isReordering
              ? t('home.reorderDoneBtn') || 'Fertig'
              : t('home.reorderBtn') || 'Sortieren'}
          </Text>
        </TouchableOpacity>
      </View>

      {isReordering && (
        <View
          style={[
            styles.reorderBanner,
            {
              backgroundColor: colors.goldDim,
              borderColor: colors.goldBorder,
            },
          ]}
        >
          <AppIcon name="reorder" size={14} color={colors.gold} />
          <Text style={[styles.reorderBannerText, { color: colors.gold }]}>
            {t('home.reorderBannerHint') ||
              'Reihenfolge über die Pfeile (▲/▼) anpassen'}
          </Text>
        </View>
      )}

      {/* Segment-Specific Filter Strip */}
      {activeSegment === 'logins' && (
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                selectedFilter === 'all' && {
                  backgroundColor: colors.gold,
                  borderColor: colors.gold,
                },
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
                  {
                    backgroundColor:
                      selectedFilter === 'all'
                        ? 'rgba(255,255,255,0.22)'
                        : colors.borderSubtle,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterCountText,
                    {
                      color:
                        selectedFilter === 'all' ? '#ffffff' : colors.textMuted,
                    },
                  ]}
                >
                  {getCategoryCount('all')}
                </Text>
              </View>
            </TouchableOpacity>

            {categories.map((cat) => {
              const isSelected = selectedFilter === cat.id;
              const displayName = cat.isDefault
                ? t(`categories.${cat.id}`) || cat.name
                : cat.name;
              const count = getCategoryCount(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    isSelected && {
                      backgroundColor: colors.gold,
                      borderColor: colors.gold,
                    },
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
                        {
                          backgroundColor: isSelected
                            ? 'rgba(255,255,255,0.22)'
                            : colors.borderSubtle,
                        },
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
              style={[
                styles.addCategoryChip,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
              onPress={() => setShowCategoryModal(true)}
              activeOpacity={0.7}
            >
              <AppIcon name="plus" size={13} color={colors.gold} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {activeSegment === 'codes' && codes.length > 0 && (
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                selectedCodeCat === 'all' && {
                  backgroundColor: colors.gold,
                  borderColor: colors.gold,
                },
              ]}
              onPress={() => setSelectedCodeCat('all')}
            >
              <CategoryIcon
                name="keypad"
                size={13}
                color={selectedCodeCat === 'all' ? '#ffffff' : colors.gold}
              />
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color:
                      selectedCodeCat === 'all' ? '#ffffff' : colors.textSecondary,
                    fontWeight: selectedCodeCat === 'all' ? '700' : '500',
                  },
                ]}
              >
                {t('categories.all')}
              </Text>
            </TouchableOpacity>
            {CODE_CATEGORIES.map((cc) => {
              const isSelected = selectedCodeCat === cc.id;
              return (
                <TouchableOpacity
                  key={cc.id}
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    isSelected && {
                      backgroundColor: colors.gold,
                      borderColor: colors.gold,
                    },
                  ]}
                  onPress={() => setSelectedCodeCat(cc.id)}
                >
                  <CategoryIcon
                    name={cc.icon}
                    size={13}
                    color={isSelected ? '#ffffff' : colors.gold}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isSelected ? '#ffffff' : colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {t(cc.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Main Content Area by Segment */}
      {isLoadingData ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
          <CredentialCardSkeleton />
          <CredentialCardSkeleton />
          <CredentialCardSkeleton />
        </View>
      ) : activeSegment === 'logins' ? (
        credentials.length === 0 ? (
          <View style={styles.empty}>
            <AppIcon
              name="lock"
              size={44}
              color={colors.gold}
              style={{ marginBottom: 14 }}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('home.noEntries')}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('home.noEntriesText')}
            </Text>
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: colors.goldDim, borderColor: colors.goldBorder },
              ]}
              onPress={() =>
                navigation.navigate('Credentials', { initialType: 'login' })
              }
            >
              <Text style={[styles.addButtonText, { color: colors.gold }]}>
                {t('home.addButton')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.restoreVaultEmptyBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
              onPress={() =>
                navigation.navigate('VaultTransfer', { mode: 'check_or_receive' })
              }
            >
              <Text
                style={[
                  styles.restoreVaultEmptyText,
                  { color: colors.textSecondary },
                ]}
              >
                {t('settings.restoreVault') || 'Restore from Cloud Vault'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : filteredCredentials.length === 0 ? (
          <View style={styles.empty}>
            <AppIcon
              name="folder"
              size={44}
              color={colors.gold}
              style={{ marginBottom: 14 }}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('home.noEntriesInCategory')}
            </Text>
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: colors.goldDim, borderColor: colors.goldBorder },
              ]}
              onPress={() =>
                navigation.navigate('Credentials', { initialType: 'login' })
              }
            >
              <Text style={[styles.addButtonText, { color: colors.gold }]}>
                {t('home.addButton')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={groupedDomains}
            keyExtractor={(item) => item.domain}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.gold}
              />
            }
            contentContainerStyle={styles.list}
            renderItem={({ item: group, index: groupIdx }) => {
              const accountCount = group.accounts.length;
              const countText =
                accountCount === 1
                  ? t('home.accountSingle')
                  : t('home.accountsPlural', { count: accountCount });
              const canMoveGroupUp = groupIdx > 0;
              const canMoveGroupDown = groupIdx < groupedDomains.length - 1;

              return (
                <View
                  style={[
                    styles.domainGroupCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    isReordering && { borderColor: colors.goldBorder },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onLongPress={() => {
                      triggerSmoothOrderAnim();
                      setIsReordering((prev) => !prev);
                    }}
                    style={[
                      styles.domainGroupHeader,
                      { borderBottomColor: colors.borderSubtle },
                    ]}
                  >
                    <View style={styles.domainGroupHeaderLeft}>
                      <FaviconImage
                        domain={group.domain}
                        size={30}
                        borderRadius={6}
                        style={{ marginRight: 10 }}
                      />
                      <View style={styles.domainGroupTitleCol}>
                        <Text
                          style={[styles.domainGroupTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {group.domain}
                        </Text>
                        <Text
                          style={[
                            styles.domainGroupSubtitle,
                            { color: colors.textMuted },
                          ]}
                        >
                          {countText}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.domainGroupHeaderRight}>
                      {isReordering ? (
                        renderReorderControls(
                          canMoveGroupUp,
                          canMoveGroupDown,
                          () => handleMoveDomain(groupIdx, -1),
                          () => handleMoveDomain(groupIdx, 1)
                        )
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.groupActionBtn,
                              {
                                backgroundColor: colors.goldDim,
                                borderColor: colors.goldBorder,
                              },
                            ]}
                            onPress={() =>
                              navigation.navigate('Credentials', {
                                prefillDomain: group.domain,
                                initialType: 'login',
                              })
                            }
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <AppIcon name="plus" size={13} color={colors.gold} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.groupActionBtn,
                              {
                                backgroundColor: colors.cardBg,
                                borderColor: colors.borderSubtle,
                              },
                            ]}
                            onPress={() => handleDeleteDomain(group.domain)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <AppIcon name="close" size={13} color={colors.textMuted} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.domainAccountsList}>
                    {group.accounts.map((account, index) => {
                      const isLast = index === group.accounts.length - 1;
                      const catInfo = getCategoryInfo(account.category);
                      const displayName = account.name
                        ? account.name
                        : account.hidden
                        ? t('credentials.sharedAccount')
                        : account.username;
                      const showUsernameSub = account.name && !account.hidden;
                      const canMoveAccUp = index > 0;
                      const canMoveAccDown = index < group.accounts.length - 1;

                      return (
                        <TapFeedback
                          key={account.id || `${group.domain}_${index}`}
                          style={[
                            styles.accountItemRow,
                            !isLast && [
                              styles.accountItemBorder,
                              { borderBottomColor: colors.borderSubtle },
                            ],
                          ]}
                          onLongPress={() => {
                            triggerSmoothOrderAnim();
                            setIsReordering((prev) => !prev);
                          }}
                          onPress={() => {
                            if (isReordering) return;
                            navigation.navigate('ViewCredential', {
                              itemType: 'login',
                              domain: group.domain,
                              id: account.id,
                            });
                          }}
                        >
                          <View
                            style={[
                              styles.accountAvatarCircle,
                              { backgroundColor: colors.goldDim },
                            ]}
                          >
                            <AppIcon
                              name={account.hidden ? 'lock' : 'user'}
                              size={14}
                              color={
                                account.hidden ? colors.gold : colors.textSecondary
                              }
                            />
                          </View>

                          <View style={styles.accountItemInfo}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                              }}
                            >
                              <Text
                                style={[
                                  styles.accountItemName,
                                  { color: colors.text },
                                ]}
                                numberOfLines={1}
                              >
                                {displayName}
                              </Text>
                              {account.hasNote && (
                                <View
                                  style={[
                                    styles.noteBadge,
                                    {
                                      backgroundColor: colors.goldDim,
                                      borderColor: colors.goldBorder,
                                    },
                                  ]}
                                >
                                  <AppIcon name="note" size={10} color={colors.gold} />
                                </View>
                              )}
                              {account.hidden && (
                                <View
                                  style={[
                                    styles.hiddenBadge,
                                    {
                                      backgroundColor: colors.goldDim,
                                      borderColor: colors.goldBorder,
                                    },
                                  ]}
                                >
                                  <AppIcon name="lock" size={9} color={colors.gold} />
                                  <Text
                                    style={[
                                      styles.hiddenBadgeText,
                                      { color: colors.gold },
                                    ]}
                                  >
                                    {t('viewCredential.hidden') || 'Geschützt'}
                                  </Text>
                                </View>
                              )}
                              {catInfo && (
                                <View
                                  style={[
                                    styles.categoryBadge,
                                    {
                                      backgroundColor: colors.goldDim,
                                      borderColor: colors.goldBorder,
                                    },
                                  ]}
                                >
                                  <CategoryIcon
                                    name={catInfo.icon}
                                    size={10}
                                    color={colors.gold}
                                  />
                                  <Text
                                    style={[
                                      styles.categoryBadgeText,
                                      { color: colors.gold },
                                    ]}
                                  >
                                    {catInfo.displayName}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {showUsernameSub && (
                              <Text
                                style={[
                                  styles.accountItemUsername,
                                  { color: colors.textSecondary },
                                ]}
                                numberOfLines={1}
                              >
                                {account.username}
                              </Text>
                            )}

                            {account.expiresAt && (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  marginTop: 2,
                                }}
                              >
                                <AppIcon name="clock" size={10} color={colors.red} />
                                <Text style={{ fontSize: 10, color: colors.red }}>
                                  Ablauf:{' '}
                                  {new Date(account.expiresAt).toLocaleDateString()}
                                </Text>
                              </View>
                            )}
                          </View>

                          {isReordering ? (
                            group.accounts.length > 1 ? (
                              renderReorderControls(
                                canMoveAccUp,
                                canMoveAccDown,
                                () =>
                                  handleMoveDomainAccount(
                                    group.domain,
                                    group.accounts,
                                    index,
                                    -1
                                  ),
                                () =>
                                  handleMoveDomainAccount(
                                    group.domain,
                                    group.accounts,
                                    index,
                                    1
                                  )
                              )
                            ) : null
                          ) : (
                            <TouchableOpacity
                              style={styles.accountDeleteBtn}
                              onPress={() => handleDeleteAccount(group.domain, account)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <AppIcon name="close" size={13} color={colors.textMuted} />
                            </TouchableOpacity>
                          )}
                        </TapFeedback>
                      );
                    })}
                  </View>
                </View>
              );
            }}
          />
        )
      ) : activeSegment === 'cards' ? (
        groupedBankAccounts.length === 0 ? (
          <View style={styles.empty}>
            <AppIcon
              name="card"
              size={44}
              color={colors.gold}
              style={{ marginBottom: 14 }}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('cards.emptyTitle')}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('cards.emptySub')}
            </Text>
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: colors.goldDim, borderColor: colors.goldBorder },
              ]}
              onPress={() =>
                navigation.navigate('Credentials', { initialType: 'card' })
              }
            >
              <Text style={[styles.addButtonText, { color: colors.gold }]}>
                {t('cards.addCardBtn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.restoreVaultEmptyBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
              onPress={() =>
                navigation.navigate('Credentials', {
                  initialType: 'card',
                  cardSubMode: 'accountOnly',
                })
              }
            >
              <Text
                style={[
                  styles.restoreVaultEmptyText,
                  { color: colors.textSecondary },
                ]}
              >
                {t('cards.addAccountOnlyBtn')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={groupedBankAccounts}
            keyExtractor={(item) => item.key}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.gold}
              />
            }
            contentContainerStyle={styles.list}
            renderItem={({ item: group, index: groupIdx }) => {
              const isIbanRevealed = !!revealedIbanIds[group.key];
              const cardCount = group.cards.length;
              const cardCountLabel =
                cardCount === 1
                  ? t('cards.cardCountSingle')
                  : t('cards.cardCountPlural', { count: cardCount });
              const canMoveBankUp = groupIdx > 0;
              const canMoveBankDown = groupIdx < groupedBankAccounts.length - 1;

              return (
                <View
                  style={[
                    styles.domainGroupCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    isReordering && { borderColor: colors.goldBorder },
                  ]}
                >
                  {/* Bank Account Group Header */}
                  <View
                    style={[
                      styles.domainGroupHeader,
                      { borderBottomColor: colors.borderSubtle },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.domainGroupHeaderLeft}
                      activeOpacity={group.accountId ? 0.7 : 1}
                      onLongPress={() => {
                        triggerSmoothOrderAnim();
                        setIsReordering((prev) => !prev);
                      }}
                      onPress={() => {
                        if (isReordering) return;
                        if (group.accountId) {
                          navigation.navigate('ViewCredential', {
                            itemType: 'bankAccount',
                            bankAccountId: group.accountId,
                          });
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.accountAvatarCircle,
                          {
                            backgroundColor: colors.goldDim,
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                          },
                        ]}
                      >
                        <CategoryIcon
                          name="briefcase"
                          size={16}
                          color={colors.gold}
                        />
                      </View>

                      <View style={styles.domainGroupTitleCol}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Text
                            style={[
                              styles.domainGroupTitle,
                              { color: colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {group.name}
                          </Text>
                          {!!group.bankName && (
                            <View
                              style={[
                                styles.categoryBadge,
                                {
                                  backgroundColor: colors.goldDim,
                                  borderColor: colors.goldBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.categoryBadgeText,
                                  { color: colors.gold },
                                ]}
                                numberOfLines={1}
                              >
                                {group.bankName}
                              </Text>
                            </View>
                          )}
                          {!!group.bic && (
                            <View
                              style={[
                                styles.categoryBadge,
                                {
                                  backgroundColor: colors.cardBg,
                                  borderColor: colors.borderSubtle,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.categoryBadgeText,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {group.bic}
                              </Text>
                            </View>
                          )}
                        </View>

                        {!!group.iban ? (
                          <Text
                            style={[
                              styles.domainGroupSubtitle,
                              {
                                color: isIbanRevealed
                                  ? colors.gold
                                  : colors.textSecondary,
                                fontWeight: '600',
                                letterSpacing: 0.5,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {formatIban(group.iban, !isIbanRevealed)}
                          </Text>
                        ) : (
                          <Text
                            style={[
                              styles.domainGroupSubtitle,
                              { color: colors.textMuted },
                            ]}
                          >
                            {cardCountLabel}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>

                    <View style={styles.domainGroupHeaderRight}>
                      {isReordering ? (
                        renderReorderControls(
                          canMoveBankUp,
                          canMoveBankDown,
                          () => handleMoveBankAccountGroup(groupIdx, -1),
                          () => handleMoveBankAccountGroup(groupIdx, 1)
                        )
                      ) : (
                        <>
                          {!!group.iban && (
                            <>
                              <TouchableOpacity
                                style={[
                                  styles.groupActionBtn,
                                  {
                                    backgroundColor: colors.cardBg,
                                    borderColor: colors.borderSubtle,
                                  },
                                ]}
                                onPress={() => handleToggleRevealIban(group.key)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <AppIcon
                                  name={isIbanRevealed ? 'eyeOff' : 'eye'}
                                  size={13}
                                  color={colors.gold}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.groupActionBtn,
                                  {
                                    backgroundColor: colors.cardBg,
                                    borderColor: colors.borderSubtle,
                                  },
                                ]}
                                onPress={() => handleQuickCopyIban(group)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <AppIcon name="copy" size={13} color={colors.gold} />
                              </TouchableOpacity>
                            </>
                          )}

                          <TouchableOpacity
                            style={[
                              styles.groupActionBtn,
                              {
                                backgroundColor: colors.goldDim,
                                borderColor: colors.goldBorder,
                              },
                            ]}
                            onPress={() =>
                              navigation.navigate('Credentials', {
                                initialType: 'card',
                                prefillBankAccountId: group.accountId || undefined,
                              })
                            }
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <AppIcon name="plus" size={13} color={colors.gold} />
                          </TouchableOpacity>

                          {!!group.accountId && (
                            <TouchableOpacity
                              style={[
                                styles.groupActionBtn,
                                {
                                  backgroundColor: colors.cardBg,
                                  borderColor: colors.borderSubtle,
                                },
                              ]}
                              onPress={() => handleDeleteBankAccountGroup(group)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <AppIcon
                                name="close"
                                size={13}
                                color={colors.textMuted}
                              />
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  </View>

                  {/* Assigned Cards under this Bank Account */}
                  <View style={{ padding: 12, gap: 10 }}>
                    {group.cards.length === 0 ? (
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          paddingVertical: 12,
                          borderWidth: 1,
                          borderStyle: 'dashed',
                          borderColor: colors.goldBorder,
                          borderRadius: 10,
                          backgroundColor: colors.goldDim,
                        }}
                        onPress={() =>
                          navigation.navigate('Credentials', {
                            initialType: 'card',
                            prefillBankAccountId: group.accountId || undefined,
                          })
                        }
                      >
                        <AppIcon name="plus" size={14} color={colors.gold} />
                        <Text
                          style={{
                            color: colors.gold,
                            fontSize: 12,
                            fontWeight: '700',
                          }}
                        >
                          {t('cards.addCardToAccountBtn')}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      group.cards.map((card, cardIdx) => {
                        const theme =
                          CARD_COLOR_THEMES[card.color] ||
                          CARD_COLOR_THEMES.gold;
                        const expStatus = getCardExpiryStatus(
                          card.expiryMonth,
                          card.expiryYear
                        );
                        const brandLabel = getCardBrandDisplayName(card.brand);
                        const canMoveCardUp = cardIdx > 0;
                        const canMoveCardDown = cardIdx < group.cards.length - 1;

                        return (
                          <TapFeedback
                            key={card.id}
                            style={[styles.bankCardOuter, { marginBottom: 0 }]}
                            onLongPress={() => {
                              triggerSmoothOrderAnim();
                              setIsReordering((prev) => !prev);
                            }}
                            onPress={() => {
                              if (isReordering) return;
                              navigation.navigate('ViewCredential', {
                                itemType: 'card',
                                cardId: card.id,
                              });
                            }}
                          >
                            <LinearGradient
                              colors={theme.gradient}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={[
                                styles.bankCardGradient,
                                { borderColor: theme.border },
                              ]}
                            >
                              <View style={styles.bankCardTopRow}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                  <Text
                                    style={styles.bankCardLabel}
                                    numberOfLines={1}
                                  >
                                    {card.label || brandLabel}
                                  </Text>
                                  {!!(card.issuer || group.bankName) && (
                                    <Text
                                      style={styles.bankCardIssuer}
                                      numberOfLines={1}
                                    >
                                      {card.issuer || group.bankName}
                                      {card.bic || group.bic
                                        ? ` • ${card.bic || group.bic}`
                                        : ''}
                                    </Text>
                                  )}
                                </View>

                                <View style={styles.bankCardTopRight}>
                                  {expStatus.isExpired && (
                                    <View style={styles.cardExpiredBadge}>
                                      <Text style={styles.cardExpiredBadgeText}>
                                        {t('cards.expiredBadge')}
                                      </Text>
                                    </View>
                                  )}
                                  {!expStatus.isExpired &&
                                    expStatus.isExpiringSoon && (
                                      <View style={styles.cardSoonBadge}>
                                        <Text style={styles.cardSoonBadgeText}>
                                          {t('cards.expiringSoonBadge')}
                                        </Text>
                                      </View>
                                    )}
                                  <View
                                    style={[
                                      styles.brandPill,
                                      { borderColor: theme.accent + '66' },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.brandPillText,
                                        { color: theme.accent },
                                      ]}
                                    >
                                      {brandLabel}
                                    </Text>
                                  </View>

                                  {isReordering ? (
                                    group.cards.length > 1 ? (
                                      renderReorderControls(
                                        canMoveCardUp,
                                        canMoveCardDown,
                                        () =>
                                          handleMoveCardInGroup(
                                            group.cards,
                                            cardIdx,
                                            -1
                                          ),
                                        () =>
                                          handleMoveCardInGroup(
                                            group.cards,
                                            cardIdx,
                                            1
                                          ),
                                        true
                                      )
                                    ) : null
                                  ) : (
                                    <TouchableOpacity
                                      onPress={() => handleDeleteCardItem(card)}
                                      hitSlop={{
                                        top: 8,
                                        bottom: 8,
                                        left: 8,
                                        right: 8,
                                      }}
                                      style={{ marginLeft: 6 }}
                                    >
                                      <AppIcon
                                        name="close"
                                        size={14}
                                        color="rgba(255,255,255,0.65)"
                                      />
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>

                              <View style={styles.bankCardNumberRow}>
                                <AppIcon
                                  name="chip"
                                  size={24}
                                  color={theme.accent}
                                  style={{ marginRight: 12 }}
                                />
                                <Text style={styles.bankCardMaskedNumber}>
                                  {formatCardNumber(card.number, true)}
                                </Text>
                              </View>

                              <View style={styles.bankCardBottomRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.bankCardMetaCaption}>
                                    {t('cards.cardholderName')}
                                  </Text>
                                  <Text
                                    style={styles.bankCardHolderValue}
                                    numberOfLines={1}
                                  >
                                    {card.cardholderName ||
                                      group.holderName ||
                                      '—'}
                                  </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={styles.bankCardMetaCaption}>
                                    {t('cards.validThru')}
                                  </Text>
                                  <Text style={styles.bankCardExpiryValue}>
                                    {expStatus.formatted || '—/—'}
                                  </Text>
                                </View>
                              </View>
                            </LinearGradient>
                          </TapFeedback>
                        );
                      })
                    )}
                  </View>
                </View>
              );
            }}
          />
        )
      ) : filteredCodes.length === 0 ? (
        <View style={styles.empty}>
          <CategoryIcon
            name="keypad"
            size={44}
            color={colors.gold}
            style={{ marginBottom: 14 }}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('codes.emptyTitle')}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('codes.emptySub')}
          </Text>
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: colors.goldDim, borderColor: colors.goldBorder },
            ]}
            onPress={() =>
              navigation.navigate('Credentials', { initialType: 'code' })
            }
          >
            <Text style={[styles.addButtonText, { color: colors.gold }]}>
              {t('codes.addCodeBtn')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredCodes}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
            />
          }
          contentContainerStyle={styles.list}
          renderItem={({ item: codeItem, index: codeIdx }) => {
            const catMeta =
              CODE_CATEGORIES.find((c) => c.id === codeItem.codeCategory) ||
              CODE_CATEGORIES[0];
            const isRevealed = !!revealedCodeIds[codeItem.id];
            const canMoveCodeUp = codeIdx > 0;
            const canMoveCodeDown = codeIdx < filteredCodes.length - 1;

            return (
              <TapFeedback
                style={[
                  styles.codeTileCard,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  isReordering && { borderColor: colors.goldBorder },
                ]}
                onLongPress={() => {
                  triggerSmoothOrderAnim();
                  setIsReordering((prev) => !prev);
                }}
                onPress={() => {
                  if (isReordering) return;
                  navigation.navigate('ViewCredential', {
                    itemType: 'code',
                    codeId: codeItem.id,
                  });
                }}
              >
                <View style={styles.codeTileLeft}>
                  <View
                    style={[
                      styles.codeIconBox,
                      {
                        backgroundColor: colors.goldDim,
                        borderColor: colors.goldBorder,
                      },
                    ]}
                  >
                    <CategoryIcon
                      name={catMeta.icon}
                      size={20}
                      color={colors.gold}
                    />
                  </View>

                  <View style={styles.codeInfoCol}>
                    <View style={styles.codeTitleRow}>
                      <Text
                        style={[styles.codeTileTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {codeItem.label}
                      </Text>
                      <View
                        style={[
                          styles.categoryBadge,
                          {
                            backgroundColor: colors.goldDim,
                            borderColor: colors.goldBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryBadgeText,
                            { color: colors.gold },
                          ]}
                        >
                          {t(catMeta.labelKey)}
                        </Text>
                      </View>
                    </View>

                    {!!codeItem.location && (
                      <View style={styles.codeLocationRow}>
                        <AppIcon
                          name="location"
                          size={11}
                          color={colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.codeLocationText,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {codeItem.location}
                        </Text>
                      </View>
                    )}

                    <Text
                      style={[
                        styles.codeValuePreview,
                        { color: isRevealed ? colors.gold : colors.textMuted },
                      ]}
                    >
                      {isRevealed ? codeItem.code : '• • • • • •'}
                    </Text>
                  </View>
                </View>

                <View style={styles.codeTileActions}>
                  {isReordering ? (
                    renderReorderControls(
                      canMoveCodeUp,
                      canMoveCodeDown,
                      () => handleMoveCode(codeIdx, -1),
                      () => handleMoveCode(codeIdx, 1)
                    )
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.codeSmallBtn,
                          {
                            backgroundColor: colors.cardBg,
                            borderColor: colors.borderSubtle,
                          },
                        ]}
                        onPress={() => handleToggleRevealCode(codeItem.id)}
                      >
                        <AppIcon
                          name={isRevealed ? 'eyeOff' : 'eye'}
                          size={14}
                          color={colors.gold}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.codeSmallBtn,
                          {
                            backgroundColor: colors.goldDim,
                            borderColor: colors.goldBorder,
                          },
                        ]}
                        onPress={() => handleQuickCopyCode(codeItem)}
                      >
                        <AppIcon name="copy" size={14} color={colors.gold} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.codeSmallBtn,
                          {
                            backgroundColor: colors.cardBg,
                            borderColor: colors.borderSubtle,
                          },
                        ]}
                        onPress={() => handleDeleteCodeItem(codeItem)}
                      >
                        <AppIcon name="close" size={13} color={colors.textMuted} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </TapFeedback>
            );
          }}
        />
      )}

      {/* Category Creation Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent={true}>
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('categories.newCategory')}
            </Text>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>
              {t('categories.categoryName')}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="z.B. Shopping, Uni, Banking"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>
              {t('categories.categoryIcon')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.iconPickerScroll}
            >
              {AVAILABLE_CATEGORY_ICONS.map((iconKey) => (
                <TouchableOpacity
                  key={iconKey}
                  style={[
                    styles.iconChoice,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    newCategoryIcon === iconKey && {
                      backgroundColor: colors.goldDim,
                      borderColor: colors.gold,
                      borderWidth: 1.5,
                    },
                  ]}
                  onPress={() => setNewCategoryIcon(iconKey)}
                >
                  <CategoryIcon
                    name={iconKey}
                    size={20}
                    color={
                      newCategoryIcon === iconKey
                        ? colors.gold
                        : colors.textSecondary
                    }
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
                onPress={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                }}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t('cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreateCategory}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={colors.goldGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalSaveGradient}
                >
                  <Text style={[styles.modalSaveText, { color: '#ffffff' }]}>
                    {t('categories.createCategory')}
                  </Text>
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
        <View
          style={[
            styles.vaultModalOverlay,
            { backgroundColor: colors.modalOverlay },
          ]}
        >
          <View
            style={[
              styles.vaultModalCard,
              {
                backgroundColor: colors.modalCard,
                borderColor: colors.goldBorder,
              },
            ]}
          >
            <View
              style={[
                styles.vaultModalIconCircle,
                {
                  backgroundColor: colors.goldDim,
                  borderColor: colors.goldBorder,
                },
              ]}
            >
              <AppIcon name="shield" size={30} color={colors.gold} />
            </View>
            <Text style={[styles.vaultModalTitle, { color: colors.text }]}>
              {t('vaultPrompt.foundTitle') || 'Logindaten verfügbar'}
            </Text>
            <Text style={[styles.vaultModalDesc, { color: colors.textSecondary }]}>
              {t('vaultPrompt.foundPrompt') ||
                'Für deinen Account wurden gespeicherte Logindaten im Tresor gefunden. Möchtest du diese jetzt automatisch in die App laden?'}
            </Text>

            {isPullingVault ? (
              <View style={styles.vaultModalLoadingBox}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={[styles.vaultModalLoadingText, { color: colors.gold }]}>
                  {t('vaultPrompt.pulling') ||
                    'Daten werden geladen & entschlüsselt…'}
                </Text>
              </View>
            ) : (
              <View style={styles.vaultModalBtnRow}>
                <TouchableOpacity
                  style={[
                    styles.vaultModalCancelBtn,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                  onPress={handleDeclinePullVault}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.vaultModalCancelText,
                      { color: colors.textSecondary },
                    ]}
                  >
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
    paddingVertical: 10,
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
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.38)',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  offlineTitleText: {
    color: '#ffb340',
    fontSize: 12,
    fontWeight: '800',
  },
  offlineSubText: {
    color: 'rgba(255, 179, 64, 0.85)',
    fontSize: 11,
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
    marginTop: 2,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  heroScanGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  heroScanIconBg: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  heroScanInfo: {
    flex: 1,
  },
  heroScanTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  heroScanSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  quickBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  quickBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 2,
    minHeight: 68,
  },
  quickBarIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  quickBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 7,
    gap: 4,
  },
  segmentTabText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentCountPill: {
    flexShrink: 0,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  segmentCountText: {
    fontSize: 10,
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  reorderToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    gap: 5,
  },
  reorderToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reorderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  reorderBannerText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  reorderControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reorderArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    marginBottom: 10,
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
  // Bank Cards
  bankCardOuter: {
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bankCardGradient: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  bankCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  bankCardLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  bankCardIssuer: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  bankCardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  brandPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardExpiredBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cardExpiredBadgeText: {
    color: '#fca5a5',
    fontSize: 10,
    fontWeight: '800',
  },
  cardSoonBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#f59e0b',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cardSoonBadgeText: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '800',
  },
  bankCardNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  bankCardMaskedNumber: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  bankCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bankCardMetaCaption: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  bankCardHolderValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bankCardExpiryValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Codes
  codeTileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  codeTileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  codeIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  codeInfoCol: {
    flex: 1,
  },
  codeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  codeTileTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  codeLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  codeLocationText: {
    fontSize: 12,
  },
  codeValuePreview: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 5,
  },
  codeTileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeSmallBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 44,
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
