/**
 * ============================================================================
 * FlakeSecure Mobile App - HomeScreen
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. DATA LOADING & SYNCHRONIZATION:
 *    - loadData(): Fetches all stored credentials and categories on screen focus (useFocusEffect).
 *    - onRefresh(): Pull-to-refresh handler.
 * 
 * 2. CATEGORIZATION & FILTERING:
 *    - Horizontally scrollable category filter chips with item count badges.
 *    - handleCreateCategory(): Creates new custom categories with custom name and icon.
 *    - handleCategoryLongPress(cat): Confirmation dialog for deleting custom categories.
 * 
 * 3. CREDENTIAL LIST RENDERING:
 *    - Renders credentials with domain icons, usernames, and status badges (category, hidden status 🔒, expiry countdown ⏱).
 *    - handleDelete(domain): Confirmation dialog and deletion of credentials.
 *    - Primary scan button navigating to QR code scanner (ScanScreen).
 * ============================================================================
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, RefreshControl, ScrollView, Modal, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAllCredentials, deleteCredentials, getCategories, saveCategory, deleteCategory } from '../utils/storage';
import { i18n } from '../i18n';

const AVAILABLE_ICONS = ['👤', '💼', '💳', '💬', '🎮', '📁', '🛍️', '🛒', '🔒', '🏠', '✈️', '📧', '🎓', '💻', '🎵', '🍔', '🚗', '🏥', '🔑', '⭐'];

export default function HomeScreen({ navigation }) {
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
        getCategories()
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
      i18n.t('home.deleteConfirmTitle'),
      i18n.t('home.deleteConfirmMsg', { domain: domain }),
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        { 
          text: i18n.t('delete'), 
          style: 'destructive',
          onPress: async () => {
            await deleteCredentials(domain);
            loadData();
          }
        }
      ]
    );
  };

  const handleCreateCategory = async () => {
    const cleanName = newCategoryName.trim();
    if (!cleanName) {
      Alert.alert(i18n.t('error'), 'Please enter a category name');
      return;
    }

    try {
      const updatedCats = await saveCategory({ name: cleanName, icon: newCategoryIcon });
      setCategories(updatedCats);
      const created = updatedCats.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
      if (created) {
        setSelectedFilter(created.id);
      }
      setNewCategoryName('');
      setNewCategoryIcon('🏷️');
      setShowCategoryModal(false);
    } catch (e) {
      Alert.alert(i18n.t('error'), 'Failed to create category');
    }
  };

  const handleCategoryLongPress = (cat) => {
    if (cat.isDefault) return;
    const displayName = cat.name;
    Alert.alert(
      i18n.t('categories.deleteCategoryConfirm'),
      i18n.t('categories.deleteCategoryMsg', { name: displayName }),
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        {
          text: i18n.t('delete'),
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteCategory(cat.id);
            setCategories(updated);
            if (selectedFilter === cat.id) {
              setSelectedFilter('all');
            }
          }
        }
      ]
    );
  };

  const getDomainIcon = (domain) => {
    const icons = {
      'google.com': '🌐', 'github.com': '🐱', 'amazon.com': '📦',
      'apple.com': '🍎', 'ea.com': '🎮', 'netflix.com': '🎬',
      'spotify.com': '🎵', 'twitter.com': '🐦', 'linkedin.com': '💼',
      'gmx.net': '📧', 'web.de': '📧', 'riotgames.com': '🎮', 'playvalorant.com': '🎮'
    };
    for (const [key, icon] of Object.entries(icons)) {
      if (domain.includes(key.split('.')[0])) return icon;
    }
    return '🔑';
  };

  const getCategoryInfo = (categoryId) => {
    if (!categoryId) return null;
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return null;
    const displayName = cat.isDefault ? (i18n.t(`categories.${cat.id}`) || cat.name) : cat.name;
    return { ...cat, displayName };
  };

  const filteredCredentials = credentials.filter(item => {
    if (selectedFilter === 'all') return true;
    return item.category === selectedFilter;
  });

  const getCategoryCount = (catId) => {
    if (catId === 'all') return credentials.length;
    return credentials.filter(c => c.category === catId).length;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Text style={styles.logoEmoji}>❄️</Text>
          <Text style={styles.logoText}>Flake<Text style={styles.logoAccent}>Secure</Text></Text>
          <TouchableOpacity 
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>{i18n.t('home.subtitle')}</Text>
      </View>

      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => navigation.navigate('Scan')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#6391ff', '#7c6aff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.scanButtonGradient}
        >
          <Text style={styles.scanButtonIcon}>📷</Text>
          <View>
            <Text style={styles.scanButtonTitle}>{i18n.t('home.scanQr')}</Text>
            <Text style={styles.scanButtonSub}>{i18n.t('home.scanQrSub')}</Text>
          </View>
          <Text style={styles.scanButtonArrow}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={styles.filterChipIcon}>🌟</Text>
            <Text style={[styles.filterChipText, selectedFilter === 'all' && styles.filterChipTextActive]}>
              {i18n.t('categories.all')}
            </Text>
            <View style={[styles.filterCountBadge, selectedFilter === 'all' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, selectedFilter === 'all' && styles.filterCountTextActive]}>
                {getCategoryCount('all')}
              </Text>
            </View>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isSelected = selectedFilter === cat.id;
            const displayName = cat.isDefault ? (i18n.t(`categories.${cat.id}`) || cat.name) : cat.name;
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {i18n.t('home.savedCredentials')}
          <Text style={styles.count}> ({filteredCredentials.length})</Text>
        </Text>
      </View>

      {credentials.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyTitle}>{i18n.t('home.noEntries')}</Text>
          <Text style={styles.emptyText}>
            {i18n.t('home.noEntriesText')}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('Credentials')}
          >
            <Text style={styles.addButtonText}>{i18n.t('home.addButton')}</Text>
          </TouchableOpacity>
        </View>
      ) : filteredCredentials.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📁</Text>
          <Text style={styles.emptyTitle}>{i18n.t('home.noEntriesInCategory')}</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('Credentials')}
          >
            <Text style={styles.addButtonText}>{i18n.t('home.addButton')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredCredentials}
          keyExtractor={item => item.domain}
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
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
                    <Text style={styles.credDomain}>{item.domain}</Text>
                    {item.hidden && <Text style={{fontSize: 12}}>🔒</Text>}
                    {catInfo && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeIcon}>{catInfo.icon}</Text>
                        <Text style={styles.categoryBadgeText}>{catInfo.displayName}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.credUsername}>{item.username}</Text>
                  {item.expiresAt && (
                    <Text style={{fontSize: 11, color: '#ff6b6b', marginTop: 2}}>⏱ Expires {new Date(item.expiresAt).toLocaleDateString()}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.credDelete}
                  onPress={() => handleDelete(item.domain)}
                >
                  <Text style={styles.credDeleteText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={() => (
            <TouchableOpacity
              style={styles.addMoreBtn}
              onPress={() => navigation.navigate('Credentials')}
            >
              <Text style={styles.addMoreText}>{i18n.t('home.addMore')}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{i18n.t('categories.newCategory')}</Text>
            
            <Text style={styles.modalLabel}>{i18n.t('categories.categoryName')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={i18n.t('categories.categoryNamePlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoCapitalize="words"
            />

            <Text style={styles.modalLabel}>{i18n.t('categories.selectIcon')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPickerScroll}>
              <View style={styles.iconPickerRow}>
                {AVAILABLE_ICONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconOption, newCategoryIcon === icon && styles.iconOptionSelected]}
                    onPress={() => setNewCategoryIcon(icon)}
                  >
                    <Text style={styles.iconOptionText}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={styles.modalCancelText}>{i18n.t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreateCategory}
              >
                <LinearGradient
                  colors={['#6391ff', '#7c6aff']}
                  style={styles.modalSaveGradient}
                >
                  <Text style={styles.modalSaveText}>{i18n.t('save')}</Text>
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
  container: { flex: 1, backgroundColor: '#090b14' },
  header: { padding: 24, paddingBottom: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  logoEmoji: { fontSize: 28 },
  logoText: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  logoAccent: { color: '#6391ff' },
  settingsBtn: { marginLeft: 'auto', padding: 8 },
  settingsIcon: { fontSize: 24 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginLeft: 36 },
  scanButton: { marginHorizontal: 20, marginBottom: 18, borderRadius: 18, overflow: 'hidden' },
  scanButtonGradient: {
    flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14
  },
  scanButtonIcon: { fontSize: 28 },
  scanButtonTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  scanButtonSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  scanButtonArrow: { fontSize: 24, color: 'rgba(255,255,255,0.6)', marginLeft: 'auto' },

  filterSection: { marginBottom: 16 },
  filterScroll: { paddingHorizontal: 20, gap: 8, flexDirection: 'row', alignItems: 'center' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12
  },
  filterChipActive: {
    backgroundColor: 'rgba(99,145,255,0.18)',
    borderColor: '#6391ff'
  },
  filterChipIcon: { fontSize: 14 },
  filterChipText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  filterCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 2
  },
  filterCountBadgeActive: {
    backgroundColor: '#6391ff',
  },
  filterCountText: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  filterCountTextActive: { color: '#fff' },
  addCategoryChip: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(99,145,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.3)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center'
  },
  addCategoryChipIcon: { fontSize: 14, color: '#6391ff' },

  section: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.08 },
  count: { color: '#6391ff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingHorizontal: 40 },
  addButton: {
    marginTop: 20, backgroundColor: 'rgba(99,145,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.3)',
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10
  },
  addButtonText: { color: '#6391ff', fontWeight: '600', fontSize: 14 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  credItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, padding: 14, marginBottom: 10
  },
  credIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(99,145,255,0.1)',
    alignItems: 'center', justifyContent: 'center'
  },
  credIconText: { fontSize: 22 },
  credInfo: { flex: 1 },
  credDomain: { fontSize: 15, fontWeight: '600', color: '#fff' },
  categoryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(99,145,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.25)',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2
  },
  categoryBadgeIcon: { fontSize: 10 },
  categoryBadgeText: { fontSize: 10, color: '#8eb0ff', fontWeight: '600' },
  credUsername: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  credDelete: { padding: 8 },
  credDeleteText: { fontSize: 14, color: 'rgba(255,255,255,0.3)' },
  addMoreBtn: {
    alignItems: 'center', padding: 16,
    borderWidth: 1, borderStyle: 'dashed',
    borderColor: 'rgba(99,145,255,0.25)',
    borderRadius: 14, marginTop: 4
  },
  addMoreText: { color: '#6391ff', fontSize: 14, fontWeight: '500' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 20
  },
  modalContent: {
    width: '100%', maxWidth: 360,
    backgroundColor: '#121624',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.25)',
    borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 10
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 16, textAlign: 'center' },
  modalLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 8 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 15, marginBottom: 16
  },
  iconPickerScroll: { marginBottom: 20 },
  iconPickerRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  iconOption: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center'
  },
  iconOptionSelected: {
    backgroundColor: 'rgba(99,145,255,0.2)',
    borderColor: '#6391ff'
  },
  iconOptionText: { fontSize: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center'
  },
  modalCancelText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
  modalSaveBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  modalSaveGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' }
});
