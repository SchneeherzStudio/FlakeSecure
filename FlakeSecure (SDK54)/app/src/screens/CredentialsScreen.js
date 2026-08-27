/**
 * ============================================================================
 * FlakeSecure Mobile App - Create / Add Credentials Screen (CredentialsScreen)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. FORM MANAGEMENT & CATEGORY SELECTION:
 *    - loadCategories(): Fetches saved categories for assignment.
 *    - handleCreateCategory(): Modal dialog for creating new custom categories.
 * 
 * 2. STORAGE (handleSave):
 *    - Validates inputs (domain, username, password).
 *    - Normalizes domains (strips https://, www, path prefixes/suffixes).
 *    - Persists encrypted credentials into SecureStore (saveCredentials).
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { saveCredentials, getCategories, saveCategory } from '../utils/storage';
import { i18n } from '../i18n';

const AVAILABLE_ICONS = ['👤', '💼', '💳', '💬', '🎮', '📁', '🛍️', '🛒', '🔒', '🏠', '✈️', '📧', '🎓', '💻', '🎵', '🍔', '🚗', '🏥', '🔑', '⭐'];

export default function CredentialsScreen({ route, navigation }) {
  const prefillDomain = route.params?.prefillDomain || '';
  const [domain, setDomain] = useState(prefillDomain);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('🏷️');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (e) {
      console.log('Failed to load categories', e);
    }
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
        setSelectedCategory(created.id);
      }
      setNewCategoryName('');
      setNewCategoryIcon('🏷️');
      setShowCategoryModal(false);
    } catch (e) {
      Alert.alert(i18n.t('error'), 'Failed to create category');
    }
  };

  const handleSave = async () => {
    if (!domain.trim() || !username.trim() || !password.trim()) {
      Alert.alert(i18n.t('error'), i18n.t('viewCredential.allFieldsRequired'));
      return;
    }

    let normalizedDomain = domain.trim().toLowerCase();
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    setSaving(true);
    try {
      await saveCredentials(normalizedDomain, username.trim(), password, {
        category: selectedCategory
      });
      Alert.alert(
        i18n.t('credentials.savedTitle'),
        i18n.t('credentials.savedMsg', { domain: normalizedDomain }),
        [{ text: i18n.t('ok'), onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert(i18n.t('error'), i18n.t('viewCredential.saveFailed', { message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>‹ {i18n.t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{i18n.t('credentials.title')}</Text>
            <Text style={styles.subtitle}>End-to-end encrypted locally</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>🔐</Text>
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Lokale Verschlüsselung</Text>
              <Text style={styles.infoDesc}>
                Deine Daten werden mit expo-secure-store im Keychain (iOS) bzw. Keystore (Android) gespeichert.
              </Text>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{i18n.t('credentials.domainLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={i18n.t('credentials.domainPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={domain}
                onChangeText={setDomain}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={styles.hint}>Ohne „https://" und „www."</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{i18n.t('credentials.usernameLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={i18n.t('credentials.usernamePlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{i18n.t('credentials.passwordLabel')}</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder={i18n.t('credentials.passwordPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.showBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.showBtnText}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{i18n.t('credentials.categoryLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                <TouchableOpacity
                  style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.categoryChipIcon}>🚫</Text>
                  <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
                    {i18n.t('credentials.categoryNone')}
                  </Text>
                </TouchableOpacity>

                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const displayName = cat.isDefault ? (i18n.t(`categories.${cat.id}`) || cat.name) : cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                      onPress={() => setSelectedCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.categoryChipIcon}>{cat.icon || '🏷️'}</Text>
                      <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                        {displayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={styles.newCategoryChip}
                  onPress={() => setShowCategoryModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.newCategoryChipIcon}>➕</Text>
                  <Text style={styles.newCategoryChipText}>{i18n.t('credentials.addCategoryBtn')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={saving ? ['#333', '#444'] : ['#6391ff', '#7c6aff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGradient}
            >
              <Text style={styles.saveBtnText}>
                {saving ? i18n.t('credentials.saving') : i18n.t('credentials.saveButton')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

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
  scroll: { padding: 24, paddingBottom: 48 },
  header: { marginBottom: 24 },
  backBtn: { marginBottom: 16 },
  backText: { color: '#6391ff', fontSize: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  infoCard: {
    flexDirection: 'row', gap: 14, alignItems: 'flex-start',
    backgroundColor: 'rgba(99,145,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.18)',
    borderRadius: 16, padding: 16, marginBottom: 28
  },
  infoIcon: { fontSize: 22 },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#8eb0ff', marginBottom: 4 },
  infoDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 18 },
  form: { gap: 20, marginBottom: 28 },
  fieldGroup: { gap: 8 },
  label: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 0.08
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 15, flex: 1
  },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  passwordRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  passwordInput: { flex: 1 },
  showBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, width: 50, height: 50,
    alignItems: 'center', justifyContent: 'center'
  },
  showBtnText: { fontSize: 18 },

  categoryScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12
  },
  categoryChipActive: {
    backgroundColor: 'rgba(99,145,255,0.16)',
    borderColor: '#6391ff',
  },
  categoryChipIcon: { fontSize: 14 },
  categoryChipText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },
  newCategoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(99,145,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.3)', borderStyle: 'dashed',
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12
  },
  newCategoryChipIcon: { fontSize: 12, color: '#6391ff' },
  newCategoryChipText: { fontSize: 13, color: '#6391ff', fontWeight: '600' },

  saveButton: { borderRadius: 16, overflow: 'hidden' },
  saveGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },

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
