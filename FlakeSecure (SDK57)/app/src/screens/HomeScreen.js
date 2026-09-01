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
 *    - Instant navigation shortcuts: Scan QR 📸, Authenticator 2FA 🔑, Activity Logs 📋, Add Login ➕.
 * 
 * 3. CATEGORIZATION & FILTERING:
 *    - Horizontally scrollable category filter chips with live credential counts.
 *    - Custom category creation modal and long-press deletion.
 * 
 * 4. CREDENTIAL LIST RENDERING:
 *    - Displays saved domain credentials with security badges (hidden 🔒, expiring ⏱, category tag).
 *    - Tap to view/edit with biometric gate, swipe/button to delete.
 * ============================================================================
 */

import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getAllCredentials, deleteCredentials, getCategories, saveCategory, deleteCategory } from '../utils/storage';

const AVAILABLE_ICONS = ['👤', '💼', '💳', '💬', '🎮', '📁', '🛍️', '🛒', '🔒', '🏠', '✈️', '📧', '🎓', '💻', '🎵', '🍔', '🚗', '🏥', '🔑', '⭐'];

export default function HomeScreen({ navigation, bannerAnnouncements = [], isOffline = false }) {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const [credentials, setCredentials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('🏷️');

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

  const handleDelete = (domain) => {
    Alert.alert(
      t('home.deleteConfirmTitle'),
      t('home.deleteConfirmMsg', { domain: domain }),
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
      setNewCategoryIcon('🏷️');
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

  const getDomainIcon = (domain) => {
    const icons = {
      'google.com': '🌐',
      'github.com': '🐱',
      'amazon.com': '📦',
      'apple.com': '🍎',
      'ea.com': '🎮',
      'netflix.com': '🎬',
      'spotify.com': '🎵',
      'twitter.com': '🐦',
      'linkedin.com': '💼',
      'gmx.net': '📧',
      'web.de': '📧',
      'riotgames.com': '🎮',
      'playvalorant.com': '🎮',
    };
    for (const [key, icon] of Object.entries(icons)) {
      if (domain.includes(key.split('.')[0])) return icon;
    }
    return '🔑';
  };

  const getCategoryInfo = (categoryId) => {
    if (!categoryId) return null;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return null;
    return {
      name: cat.name,
      displayName: cat.isDefault ? t(`categories.${cat.id}`) || cat.name : cat.name,
      icon: cat.icon || '🏷️',
    };
  };

  const filteredCredentials = credentials.filter((item) => {
    if (selectedFilter === 'all') return true;
    return item.category === selectedFilter;
  });

  const getCategoryCount = (categoryId) => {
    if (categoryId === 'all') return credentials.length;
    return credentials.filter((c) => c.category === categoryId).length;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <Text style={styles.brandEmoji}>❄️</Text>
          <Text style={styles.brandTitle}>
            Flake<Text style={styles.brandAccent}>Secure</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={styles.userBadge}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.7}
        >
          <View style={styles.userDot} />
          <Text style={styles.userBadgeText} numberOfLines={1}>
            {user?.username || t('common.account')}
          </Text>
          <Text style={styles.userChevron}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {isOffline && (
        <View style={styles.offlineBox}>
          <Text style={styles.offlineText}>📡 {t('common.offlineNotice')}</Text>
        </View>
      )}

      {bannerAnnouncements.map((banner) => (
        <View key={banner.id} style={styles.announcementBanner}>
          <Text style={styles.announcementIcon}>📢</Text>
          <Text style={styles.announcementText}>{banner.message}</Text>
        </View>
      ))}

      {/* Hero Scan Action Button */}
      <TouchableOpacity
        style={styles.heroScanBtn}
        onPress={() => navigation.navigate('Scan')}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#6391ff', '#7c6aff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroScanGradient}
        >
          <View style={styles.heroScanIconBg}>
            <Text style={styles.heroScanIcon}>📷</Text>
          </View>
          <View style={styles.heroScanInfo}>
            <Text style={styles.heroScanTitle}>{t('home.scanQr')}</Text>
            <Text style={styles.heroScanSubtitle}>{t('home.scanQrSub')}</Text>
          </View>
          <Text style={styles.heroScanArrow}>→</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Quick Action Navigation Bar */}
      <View style={styles.quickBar}>
        <TouchableOpacity
          style={styles.quickBarItem}
          onPress={() => navigation.navigate('Authenticator')}
          activeOpacity={0.7}
        >
          <View style={styles.quickBarIconCircle}>
            <Text style={styles.quickBarIconText}>🔑</Text>
          </View>
          <Text style={styles.quickBarLabel}>{t('home.quick2fa')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBarItem}
          onPress={() => navigation.navigate('Logs')}
          activeOpacity={0.7}
        >
          <View style={styles.quickBarIconCircle}>
            <Text style={styles.quickBarIconText}>📋</Text>
          </View>
          <Text style={styles.quickBarLabel}>{t('home.quickLogs')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBarItem}
          onPress={() => navigation.navigate('Credentials')}
          activeOpacity={0.7}
        >
          <View style={styles.quickBarIconCircle}>
            <Text style={styles.quickBarIconText}>➕</Text>
          </View>
          <Text style={styles.quickBarLabel}>{t('home.quickNew')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBarItem}
          onPress={() => navigation.navigate('ShareImport', { mode: 'share' })}
          activeOpacity={0.7}
        >
          <View style={styles.quickBarIconCircle}>
            <Text style={styles.quickBarIconText}>📲</Text>
          </View>
          <Text style={styles.quickBarLabel}>{t('home.quickShare')}</Text>
        </TouchableOpacity>
      </View>

      {/* Categories Filter Strip */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={styles.filterChipIcon}>🌟</Text>
            <Text style={[styles.filterChipText, selectedFilter === 'all' && styles.filterChipTextActive]}>
              {t('categories.all')}
            </Text>
            <View style={[styles.filterCountBadge, selectedFilter === 'all' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, selectedFilter === 'all' && styles.filterCountTextActive]}>
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
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setSelectedFilter(cat.id)}
                onLongPress={() => handleCategoryLongPress(cat)}
                activeOpacity={0.7}
              >
                <Text style={styles.filterChipIcon}>{cat.icon || '🏷️'}</Text>
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {displayName}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterCountBadge, isSelected && styles.filterCountBadgeActive]}>
                    <Text style={[styles.filterCountText, isSelected && styles.filterCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.addCategoryChip}
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addCategoryChipIcon}>➕</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {t('home.savedCredentials')}
          <Text style={styles.count}> ({filteredCredentials.length})</Text>
        </Text>
      </View>

      {/* Credentials List */}
      {credentials.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyTitle}>{t('home.noEntries')}</Text>
          <Text style={styles.emptyText}>{t('home.noEntriesText')}</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('Credentials')}>
            <Text style={styles.addButtonText}>{t('home.addButton')}</Text>
          </TouchableOpacity>
        </View>
      ) : filteredCredentials.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📁</Text>
          <Text style={styles.emptyTitle}>{t('home.noEntriesInCategory')}</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('Credentials')}>
            <Text style={styles.addButtonText}>{t('home.addButton')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredCredentials}
          keyExtractor={(item) => item.domain}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6391ff" />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const catInfo = getCategoryInfo(item.category);
            return (
              <TouchableOpacity
                style={styles.credItem}
                onPress={() => navigation.navigate('ViewCredential', { domain: item.domain })}
                activeOpacity={0.7}
              >
                <View style={styles.credIcon}>
                  <Text style={styles.credIconText}>{getDomainIcon(item.domain)}</Text>
                </View>
                <View style={styles.credInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.credDomain}>{item.domain}</Text>
                    {item.hidden && <Text style={{ fontSize: 12 }}>🔒</Text>}
                    {catInfo && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeIcon}>{catInfo.icon}</Text>
                        <Text style={styles.categoryBadgeText}>{catInfo.displayName}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.credUsername}>{item.username}</Text>
                  {item.expiresAt && (
                    <Text style={{ fontSize: 11, color: '#ff6b6b', marginTop: 2 }}>
                      ⏱ Ablauf: {new Date(item.expiresAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <TouchableOpacity style={styles.credDelete} onPress={() => handleDelete(item.domain)}>
                  <Text style={styles.credDeleteText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Category Creation Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('categories.newCategory')}</Text>

            <Text style={styles.modalLabel}>{t('categories.categoryName')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="z.B. Shopping, Uni, Banking"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus
            />

            <Text style={styles.modalLabel}>{t('categories.categoryIcon')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPickerScroll}>
              {AVAILABLE_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconChoice, newCategoryIcon === icon && styles.iconChoiceSelected]}
                  onPress={() => setNewCategoryIcon(icon)}
                >
                  <Text style={styles.iconChoiceText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                }}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleCreateCategory}>
                <LinearGradient
                  colors={['#6391ff', '#7c6aff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalSaveGradient}
                >
                  <Text style={styles.modalSaveText}>{t('categories.createCategory')}</Text>
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
  brandEmoji: {
    fontSize: 22,
    marginRight: 6,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: '#6391ff',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 160,
  },
  userDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4cd964',
    marginRight: 6,
  },
  userBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  userChevron: {
    fontSize: 12,
    opacity: 0.7,
  },
  offlineBox: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderColor: 'rgba(255, 149, 0, 0.3)',
    borderWidth: 1,
    borderRadius: 10,
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
    backgroundColor: 'rgba(99, 145, 255, 0.12)',
    borderColor: 'rgba(99, 145, 255, 0.25)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  announcementIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  announcementText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  heroScanBtn: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#6391ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  heroScanGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  heroScanIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  heroScanIcon: {
    fontSize: 22,
  },
  heroScanInfo: {
    flex: 1,
  },
  heroScanTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  heroScanSubtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  heroScanArrow: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  quickBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  quickBarItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  quickBarIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(99, 145, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  quickBarIconText: {
    fontSize: 16,
  },
  quickBarLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '600',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: 'rgba(99, 145, 255, 0.2)',
    borderColor: '#6391ff',
  },
  filterChipIcon: {
    fontSize: 13,
  },
  filterChipText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  filterCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterCountBadgeActive: {
    backgroundColor: '#6391ff',
  },
  filterCountText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    fontWeight: '700',
  },
  filterCountTextActive: {
    color: '#fff',
  },
  addCategoryChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 20,
    width: 36,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCategoryChipIcon: {
    fontSize: 11,
    color: '#6391ff',
  },
  sectionHeaderRow: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  count: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '400',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  credItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  credIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  credIconText: {
    fontSize: 20,
  },
  credInfo: {
    flex: 1,
  },
  credDomain: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  credUsername: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 145, 255, 0.12)',
    borderColor: 'rgba(99, 145, 255, 0.25)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    gap: 3,
  },
  categoryBadgeIcon: {
    fontSize: 10,
  },
  categoryBadgeText: {
    color: '#6391ff',
    fontSize: 10,
    fontWeight: '700',
  },
  credDelete: {
    padding: 8,
  },
  credDeleteText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 16,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: 'rgba(99, 145, 255, 0.15)',
    borderColor: 'rgba(99, 145, 255, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  addButtonText: {
    color: '#6391ff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 11, 20, 0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0f1220',
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  modalLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  iconPickerScroll: {
    marginVertical: 8,
  },
  iconChoice: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  iconChoiceSelected: {
    backgroundColor: 'rgba(99, 145, 255, 0.3)',
    borderColor: '#6391ff',
    borderWidth: 1,
  },
  iconChoiceText: {
    fontSize: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
  },
  modalCancelText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
  },
  modalSaveGradient: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
