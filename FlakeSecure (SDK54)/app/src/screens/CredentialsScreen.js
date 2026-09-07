/**
 * ============================================================================
 * FlakeSecure Mobile App - Create / Add Credentials Screen (CredentialsScreen)
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
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { AppIcon, CategoryIcon, AVAILABLE_CATEGORY_ICONS } from '../components/CategoryIcons';

export default function CredentialsScreen({ route, navigation }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
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
  const [newCategoryIcon, setNewCategoryIcon] = useState('tag');

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
    if (!domain.trim() || !username.trim() || !password.trim()) {
      Alert.alert(t('error'), t('viewCredential.allFieldsRequired'));
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
        t('credentials.savedTitle'),
        t('credentials.savedMsg', { domain: normalizedDomain }),
        [{ text: t('ok'), onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert(t('error'), t('viewCredential.saveFailed', { message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={[styles.backText, { color: colors.gold }]}>‹ {t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.textMain }]}>{t('credentials.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSub }]}>End-to-end encrypted locally</Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
            <AppIcon name="lock" size={20} color={colors.gold} />
            <View style={styles.infoText}>
              <Text style={[styles.infoTitle, { color: colors.gold }]}>Lokale Verschlüsselung</Text>
              <Text style={[styles.infoDesc, { color: colors.textSub }]}>
                Deine Daten werden mit expo-secure-store im Keychain (iOS) bzw. Keystore (Android) sicher abgelegt.
              </Text>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('credentials.domainLabel')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                placeholder={t('credentials.domainPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={domain}
                onChangeText={setDomain}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={[styles.hint, { color: colors.textMuted }]}>Ohne "https://" und "www."</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('credentials.usernameLabel')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                placeholder={t('credentials.usernamePlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('credentials.passwordLabel')}</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                  placeholder={t('credentials.passwordPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.showBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <AppIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} color={colors.gold} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('credentials.categoryLabel')}</Text>
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
                  <AppIcon name="close" size={12} color={!selectedCategory ? colors.gold : colors.textMuted} />
                  <Text style={[styles.categoryChipText, { color: !selectedCategory ? colors.gold : colors.textSub }]}>
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
                      <CategoryIcon name={cat.icon || 'tag'} size={14} color={isSelected ? colors.gold : colors.textSub} />
                      <Text style={[styles.categoryChipText, { color: isSelected ? colors.gold : colors.textSub }]}>
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
                  <AppIcon name="plus" size={12} color={colors.gold} />
                  <Text style={[styles.newCategoryChipText, { color: colors.gold }]}>{t('credentials.addCategoryBtn')}</Text>
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
              colors={saving ? ['#333', '#444'] : colors.goldGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGradient}
            >
              <Text style={styles.saveBtnText}>
                {saving ? t('credentials.saving') : t('credentials.saveButton')}
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
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textMain }]}>{t('categories.newCategory')}</Text>
            
            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>{t('categories.categoryName')}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
              placeholder={t('categories.categoryNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoCapitalize="words"
            />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>{t('categories.selectIcon')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPickerScroll}>
              <View style={styles.iconPickerRow}>
                {AVAILABLE_CATEGORY_ICONS.map((iconKey) => {
                  const isSelected = newCategoryIcon === iconKey;
                  return (
                    <TouchableOpacity
                      key={iconKey}
                      style={[
                        styles.iconOption,
                        { backgroundColor: colors.inputBg, borderColor: colors.border },
                        isSelected && { backgroundColor: colors.goldBg, borderColor: colors.gold }
                      ]}
                      onPress={() => setNewCategoryIcon(iconKey)}
                    >
                      <CategoryIcon name={iconKey} size={18} color={isSelected ? colors.gold : colors.textSub} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSub }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreateCategory}
              >
                <LinearGradient
                  colors={colors.goldGradient}
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
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },
  header: { marginBottom: 20 },
  backBtn: { marginBottom: 12 },
  backText: { fontSize: 15, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13 },
  infoCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 24
  },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  infoDesc: { fontSize: 12, lineHeight: 17 },
  form: { gap: 18, marginBottom: 24 },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5
  },
  input: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, flex: 1
  },
  hint: { fontSize: 11, marginTop: 2 },
  passwordRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  passwordInput: { flex: 1 },
  showBtn: {
    borderWidth: 1, borderRadius: 8, width: 46, height: 46,
    alignItems: 'center', justifyContent: 'center'
  },
  categoryScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8
  },
  categoryChipText: { fontSize: 12, fontWeight: '600' },
  newCategoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderStyle: 'dashed',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8
  },
  newCategoryChipText: { fontSize: 12, fontWeight: '700' },

  saveButton: { borderRadius: 8, overflow: 'hidden' },
  saveGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 20
  },
  modalContent: {
    width: '100%', maxWidth: 360,
    borderWidth: 1, borderRadius: 10, padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14, textAlign: 'center' },
  modalLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, marginBottom: 14
  },
  iconPickerScroll: { marginBottom: 16 },
  iconPickerRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  iconOption: {
    width: 40, height: 40, borderRadius: 8,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center'
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center'
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalSaveBtn: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  modalSaveGradient: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: '#ffffff', fontSize: 14, fontWeight: '800' }
});
