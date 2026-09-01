/**
 * ============================================================================
 * FlakeSecure Mobile App - View & Edit Credential Screen (ViewCredentialScreen)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. BIOMETRIC GATE (authenticateAndLoad):
 *    - Enforces biometric authentication via LocalAuthentication prior to revealing sensitive credentials.
 *    - Loads credentials and categories from SecureStore.
 *    - Enforces 'hidden' status (shared restricted credentials cannot be viewed in plaintext or edited).
 * 
 * 2. CREDENTIAL EDITING & CLIPBOARD:
 *    - copyToClipboard(text, label): Copies username or password to clipboard.
 *    - handleSave(): Persists credential updates (username, password, category) into SecureStore.
 *    - handleCreateCategory(): Creates new categories directly from the edit view.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import { getCredentialsForDomain, saveCredentials, getCategories, saveCategory } from '../utils/storage';
import { useLanguage } from '../context/LanguageContext';

const AVAILABLE_ICONS = ['👤', '💼', '💳', '💬', '🎮', '📁', '🛍️', '🛒', '🔒', '🏠', '✈️', '📧', '🎓', '💻', '🎵', '🍔', '🚗', '🏥', '🔑', '⭐'];

export default function ViewCredentialScreen({ route, navigation }) {
  const { t } = useLanguage();
  const { domain } = route.params;
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isHidden, setIsHidden] = useState(false);

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('🏷️');

  useEffect(() => {
    authenticateAndLoad();
  }, []);

  const authenticateAndLoad = async () => {
    setLoading(true);
    setAuthError('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('viewCredential.showCredentials', { domain }),
        fallbackLabel: 'PIN verwenden',
        disableDeviceFallback: false
      });

      if (!result.success) {
        setAuthError(t('viewCredential.authFailed'));
        setLoading(false);
        return;
      }

      const creds = await getCredentialsForDomain(domain);
      if (creds) {
        setSelectedCategory(creds.category || null);
        if (creds.hidden) {
          setIsHidden(true);
          setUsername(creds.username);
          setPassword('');
        } else {
          setUsername(creds.username);
          setPassword(creds.password);
        }
      } else {
        setAuthError(t('viewCredential.noCredFound'));
      }

      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (e) {}

      setIsAuthenticated(true);
    } catch (err) {
      setAuthError(t('viewCredential.biometricError', { message: err.message }));
    } finally {
      setLoading(false);
    }
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
      const created = updatedCats.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
      if (created) {
        setSelectedCategory(created.id);
      }
      setNewCategoryName('');
      setNewCategoryIcon('🏷️');
      setShowCategoryModal(false);
    } catch (e) {
      Alert.alert(t('error'), 'Failed to create category');
    }
  };

  const handleSave = async () => {
    if (!username.trim() || (!isHidden && !password.trim())) {
      Alert.alert(t('error'), t('viewCredential.allFieldsRequired'));
      return;
    }

    setSaving(true);
    try {
      await saveCredentials(domain, username.trim(), password, {
        category: selectedCategory
      });
      Alert.alert(
        t('viewCredential.savedTitle'),
        t('viewCredential.savedMsg', { domain }),
        [{ text: t('ok'), onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert(t('error'), t('viewCredential.saveFailed', { message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text, label) => {
    await Clipboard.setStringAsync(text);
    Alert.alert(t('viewCredential.copied'), t('viewCredential.copiedMsg', { label }), [{ text: t('ok') }]);
    
    // Auto-clear clipboard after 45 seconds to protect sensitive credentials (Art. 32 DSGVO)
    setTimeout(async () => {
      try {
        const current = await Clipboard.getStringAsync();
        if (current === text) {
          await Clipboard.setStringAsync('');
        }
      } catch {}
    }, 45000);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#6391ff" />
          <Text style={styles.loadingText}>{t('confirm.authenticating')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ {t('common.back')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.bigIcon}>🔒</Text>
          <Text style={styles.stateTitle}>{t('viewCredential.accessDenied')}</Text>
          <Text style={styles.errorText}>{authError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={authenticateAndLoad}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>‹ {t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{domain}</Text>
            <Text style={styles.subtitle}>{t('viewCredential.viewAndEdit')}</Text>
          </View>

          <View style={styles.form}>
            {isHidden ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 }}>
                <Text style={{ fontSize: 48 }}>🔒</Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>Restricted Credential</Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                  This credential is restricted and cannot be viewed or edited. It will still work for auto-fill.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('viewCredential.usernameLabel')}</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, styles.inputFlex]}
                      placeholder="dein@email.com"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                    />
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => copyToClipboard(username, t('viewCredential.usernameLabel'))}
                    >
                      <Text style={styles.copyBtnText}>📋</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('viewCredential.passwordLabel')}</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="••••••••••"
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
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => copyToClipboard(password, t('viewCredential.passwordLabel'))}
                    >
                      <Text style={styles.copyBtnText}>📋</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('credentials.categoryLabel')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                    <TouchableOpacity
                      style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
                      onPress={() => setSelectedCategory(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.categoryChipIcon}>🚫</Text>
                      <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
                        {t('credentials.categoryNone')}
                      </Text>
                    </TouchableOpacity>

                    {categories.map((cat) => {
                      const isSelected = selectedCategory === cat.id;
                      const displayName = cat.isDefault ? (t(`categories.${cat.id}`) || cat.name) : cat.name;
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
                      <Text style={styles.newCategoryChipText}>{t('credentials.addCategoryBtn')}</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </>
            )}
          </View>

          {!isHidden && (
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
                  {saving ? t('viewCredential.saving') : t('viewCredential.saveChanges')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
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
            <Text style={styles.modalTitle}>{t('categories.newCategory')}</Text>
            
            <Text style={styles.modalLabel}>{t('categories.categoryName')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('categories.categoryNamePlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoCapitalize="words"
            />

            <Text style={styles.modalLabel}>{t('categories.selectIcon')}</Text>
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
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreateCategory}
              >
                <LinearGradient
                  colors={['#6391ff', '#7c6aff']}
                  style={styles.modalSaveGradient}
                >
                  <Text style={styles.modalSaveText}>{t('save')}</Text>
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
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 16, color: 'rgba(255,255,255,0.5)', marginTop: 12 },
  bigIcon: { fontSize: 56, marginBottom: 8 },
  stateTitle: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center' },
  errorText: { fontSize: 14, color: '#fca5a5', textAlign: 'center', paddingHorizontal: 20 },
  retryBtn: {
    backgroundColor: 'rgba(99,145,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.3)',
    borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16
  },
  retryBtnText: { color: '#6391ff', fontWeight: '600', fontSize: 14 },
  header: { marginBottom: 24 },
  backBtn: { marginBottom: 16, alignSelf: 'flex-start' },
  backText: { color: '#6391ff', fontSize: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  form: { gap: 20, marginBottom: 28 },
  fieldGroup: { gap: 8 },
  label: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 0.08
  },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  inputFlex: { flex: 1 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 15
  },
  passwordRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  passwordInput: { flex: 1 },
  showBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, width: 50, height: 50,
    alignItems: 'center', justifyContent: 'center'
  },
  showBtnText: { fontSize: 18 },
  copyBtn: {
    backgroundColor: 'rgba(99,145,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.3)',
    borderRadius: 14, width: 50, height: 50,
    alignItems: 'center', justifyContent: 'center'
  },
  copyBtnText: { fontSize: 18 },

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
