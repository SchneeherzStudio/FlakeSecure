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
  Platform, ScrollView, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import { getCredentialsForDomain, saveCredentials, getCategories, saveCategory } from '../utils/storage';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { AppIcon, CategoryIcon, AVAILABLE_CATEGORY_ICONS } from '../components/CategoryIcons';
import FaviconImage from '../components/FaviconImage';
import { DetailFieldSkeleton } from '../components/Skeleton';
import { TapFeedback } from '../components/TapFeedback';

export default function ViewCredentialScreen({ route, navigation }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
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
  const [newCategoryIcon, setNewCategoryIcon] = useState('tag');

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
      setNewCategoryIcon('tag');
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.scroll, { paddingTop: 24 }]}>
          <DetailFieldSkeleton />
          <DetailFieldSkeleton />
          <DetailFieldSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <TapFeedback onPress={() => navigation.goBack()} style={styles.backBtn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppIcon name="back" size={16} color={colors.gold} />
              <Text style={[styles.backText, { color: colors.gold }]}>{t('common.back')}</Text>
            </View>
          </TapFeedback>
        </View>
        <View style={styles.centerContent}>
          <AppIcon name="lock" size={48} color={colors.gold} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>{t('viewCredential.accessDenied')}</Text>
          <Text style={[styles.errorText, { color: colors.danger }]}>{authError}</Text>
          <TapFeedback
            style={[styles.retryBtn, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
            onPress={authenticateAndLoad}
          >
            <Text style={[styles.retryBtnText, { color: colors.gold }]}>{t('retry')}</Text>
          </TapFeedback>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <TapFeedback onPress={() => navigation.goBack()} style={styles.backBtn}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppIcon name="back" size={16} color={colors.gold} />
                <Text style={[styles.backText, { color: colors.gold }]}>{t('common.back')}</Text>
              </View>
            </TapFeedback>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <FaviconImage domain={domain} size={36} borderRadius={8} />
              <Text style={[styles.title, { color: colors.text }]}>{domain}</Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('viewCredential.viewAndEdit')}</Text>
          </View>

          <View style={styles.form}>
            {isHidden ? (
              <View style={[styles.hiddenCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <AppIcon name="lock" size={40} color={colors.gold} />
                <Text style={[styles.hiddenTitle, { color: colors.text }]}>Restricted Credential</Text>
                <Text style={[styles.hiddenText, { color: colors.textSecondary }]}>
                  This credential is restricted and cannot be viewed or edited. It will still work for auto-fill.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{t('viewCredential.usernameLabel')}</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, styles.inputFlex, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                      placeholder="dein@email.com"
                      placeholderTextColor={colors.textMuted}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                    />
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                      onPress={() => copyToClipboard(username, t('viewCredential.usernameLabel'))}
                    >
                      <AppIcon name="copy" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{t('viewCredential.passwordLabel')}</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, styles.passwordInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                      placeholder="••••••••••"
                      placeholderTextColor={colors.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <AppIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} color={colors.gold} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                      onPress={() => copyToClipboard(password, t('viewCredential.passwordLabel'))}
                    >
                      <AppIcon name="copy" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{t('credentials.categoryLabel')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                    <TouchableOpacity
                      style={[
                        styles.categoryChip,
                        { backgroundColor: colors.cardBg, borderColor: colors.border },
                        !selectedCategory && { backgroundColor: colors.goldBg, borderColor: colors.gold }
                      ]}
                      onPress={() => setSelectedCategory(null)}
                      activeOpacity={0.7}
                    >
                      <AppIcon name="close" size={13} color={!selectedCategory ? colors.gold : colors.textMuted} />
                      <Text style={[
                        styles.categoryChipText,
                        { color: colors.textSecondary },
                        !selectedCategory && { color: colors.text, fontWeight: '700' }
                      ]}>
                        {t('credentials.categoryNone')}
                      </Text>
                    </TouchableOpacity>

                    {categories.map((cat) => {
                      const isSelected = selectedCategory === cat.id;
                      const displayName = cat.isDefault ? (t(`categories.${cat.id}`) || cat.name) : cat.name;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.categoryChip,
                            { backgroundColor: colors.cardBg, borderColor: colors.border },
                            isSelected && { backgroundColor: colors.goldBg, borderColor: colors.gold }
                          ]}
                          onPress={() => setSelectedCategory(cat.id)}
                          activeOpacity={0.7}
                        >
                          <CategoryIcon name={cat.icon || 'tag'} size={14} color={isSelected ? colors.gold : colors.textSecondary} />
                          <Text style={[
                            styles.categoryChipText,
                            { color: colors.textSecondary },
                            isSelected && { color: colors.text, fontWeight: '700' }
                          ]}>
                            {displayName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      style={[styles.newCategoryChip, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
                      onPress={() => setShowCategoryModal(true)}
                      activeOpacity={0.7}
                    >
                      <AppIcon name="plus" size={13} color={colors.gold} />
                      <Text style={[styles.newCategoryChipText, { color: colors.gold }]}>{t('credentials.addCategoryBtn')}</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </>
            )}
          </View>

          {!isHidden && (
            <TapFeedback
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
            >
              <LinearGradient
                colors={saving ? ['#333', '#444'] : colors.goldGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveGradient}
              >
                <Text style={[styles.saveBtnText, !saving && { color: '#ffffff' }]}>
                  {saving ? t('viewCredential.saving') : t('viewCredential.saveChanges')}
                </Text>
              </LinearGradient>
            </TapFeedback>
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
          <View style={[styles.modalContent, { backgroundColor: colors.cardBgModal || (colors.bg === '#07090e' ? '#0d111a' : '#ffffff'), borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('categories.newCategory')}</Text>
            
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{t('categories.categoryName')}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder={t('categories.categoryNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoCapitalize="words"
            />

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{t('categories.selectIcon')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPickerScroll}>
              <View style={styles.iconPickerRow}>
                {AVAILABLE_CATEGORY_ICONS.map((catKey) => {
                  const isSelected = newCategoryIcon === catKey;
                  return (
                    <TouchableOpacity
                      key={catKey}
                      style={[
                        styles.iconOption,
                        { backgroundColor: colors.cardBg, borderColor: colors.border },
                        isSelected && { backgroundColor: colors.goldBg, borderColor: colors.gold }
                      ]}
                      onPress={() => setNewCategoryIcon(catKey)}
                    >
                      <CategoryIcon name={catKey} size={18} color={isSelected ? colors.gold : colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreateCategory}
              >
                <LinearGradient
                  colors={colors.goldGradient}
                  style={styles.modalSaveGradient}
                >
                  <Text style={[styles.modalSaveText, { color: '#ffffff' }]}>{t('save')}</Text>
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
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  stateTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16
  },
  retryBtnText: { fontWeight: '700', fontSize: 14 },
  header: { marginBottom: 24 },
  backBtn: { marginBottom: 16, alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4 },
  form: { gap: 20, marginBottom: 28 },
  fieldGroup: { gap: 8 },
  label: {
    fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.08
  },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  inputFlex: { flex: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15
  },
  passwordRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  passwordInput: { flex: 1 },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8, width: 48, height: 48,
    alignItems: 'center', justifyContent: 'center'
  },
  hiddenCard: {
    alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12,
    borderRadius: 8, borderWidth: 1
  },
  hiddenTitle: { fontSize: 18, fontWeight: '800' },
  hiddenText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  categoryScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8
  },
  categoryChipText: { fontSize: 13, fontWeight: '500' },
  newCategoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderStyle: 'dashed',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8
  },
  newCategoryChipText: { fontSize: 13, fontWeight: '700' },

  saveButton: { borderRadius: 8, overflow: 'hidden' },
  saveGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '800' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 20
  },
  modalContent: {
    width: '100%', maxWidth: 360,
    borderWidth: 1,
    borderRadius: 8, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 10
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  modalLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, marginBottom: 16
  },
  iconPickerScroll: { marginBottom: 20 },
  iconPickerRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  iconOption: {
    width: 44, height: 44, borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center'
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center'
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalSaveBtn: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  modalSaveGradient: { paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { fontSize: 14, fontWeight: '800', color: '#ffffff' }
});
