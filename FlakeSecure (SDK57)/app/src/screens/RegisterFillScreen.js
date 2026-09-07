/**
 * ============================================================================
 * FlakeSecure Mobile App - Smart Registration Fill Screen (RegisterFillScreen)
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Modal, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { AppIcon, CategoryIcon, AVAILABLE_CATEGORY_ICONS } from '../components/CategoryIcons';
import { encryptCredentials } from '../utils/crypto';
import { saveCredentials, getCategories, saveCategory, getDefaultProfile, saveDefaultProfile } from '../utils/storage';
import { sendLogin } from '../utils/api';
import { TapFeedback } from '../components/TapFeedback';

const COMPACT_FIELD_MAP = {
  e: { key: 'email', label: 'E-Mail', type: 'email', required: true },
  u: { key: 'username', label: 'Benutzername', type: 'text', required: true },
  p: { key: 'password', label: 'Passwort', type: 'password', required: true },
  cp: { key: 'confirmPassword', label: 'Passwort wiederholen', type: 'password', required: true },
  fn: { key: 'firstName', label: 'Vorname', type: 'text', required: false },
  ln: { key: 'lastName', label: 'Nachname', type: 'text', required: false },
  name: { key: 'fullName', label: 'Vollständiger Name', type: 'text', required: false },
  ph: { key: 'phone', label: 'Telefonnummer', type: 'tel', required: false }
};

export default function RegisterFillScreen({ route, navigation }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const sid = route.params?.sid || route.params?.s;
  const key = route.params?.key || route.params?.k;
  const domain = route.params?.domain || route.params?.d;
  let rawFields = route.params?.fields || route.params?.f || [];

  if (typeof rawFields === 'string') {
    const decoded = decodeURIComponent(rawFields).trim();
    if (decoded.startsWith('[') || decoded.startsWith('{')) {
      try {
        rawFields = JSON.parse(decoded);
      } catch (e) {
        rawFields = [];
      }
    } else {
      const codes = decoded.split(',').map(c => c.trim()).filter(Boolean);
      rawFields = codes.map(c => COMPACT_FIELD_MAP[c] || { key: c, label: c, type: 'text', required: false });
    }
  }

  const detectedFields = Array.isArray(rawFields) ? rawFields : [];
  const hasSpecificSchema = detectedFields.length > 0;

  const isFieldDetected = (fieldKey) => {
    if (!hasSpecificSchema) return true;
    return detectedFields.some(f => f.key === fieldKey);
  };

  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [showExtraFields, setShowExtraFields] = useState(false);

  const [profileMode, setProfileMode] = useState('default');
  const [defaultProfile, setDefaultProfile] = useState(null);

  const [pwLength, setPwLength] = useState(20);
  const [pwUpper, setPwUpper] = useState(true);
  const [pwLower, setPwLower] = useState(true);
  const [pwNums, setPwNums] = useState(true);
  const [pwSymbols, setPwSymbols] = useState(true);
  const [showGeneratorOptions, setShowGeneratorOptions] = useState(false);

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('tag');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    initData();
  }, []);

  const generatePassword = (length = pwLength, opts = { upper: pwUpper, lower: pwLower, nums: pwNums, syms: pwSymbols }) => {
    const upperChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowerChars = 'abcdefghijkmnopqrstuvwxyz';
    const numChars = '23456789';
    const symChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let pool = '';
    const guaranteed = [];

    if (opts.upper) { pool += upperChars; guaranteed.push(upperChars[Math.floor(Math.random() * upperChars.length)]); }
    if (opts.lower) { pool += lowerChars; guaranteed.push(lowerChars[Math.floor(Math.random() * lowerChars.length)]); }
    if (opts.nums) { pool += numChars; guaranteed.push(numChars[Math.floor(Math.random() * numChars.length)]); }
    if (opts.syms) { pool += symChars; guaranteed.push(symChars[Math.floor(Math.random() * symChars.length)]); }

    if (!pool) pool = lowerChars + numChars;

    const result = [...guaranteed];
    for (let i = guaranteed.length; i < length; i++) {
      result.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result.join('');
  };

  const initData = async () => {
    try {
      const [cats, defProfile] = await Promise.all([
        getCategories(),
        getDefaultProfile()
      ]);
      setCategories(cats);
      setDefaultProfile(defProfile);

      const initEmail = defProfile?.email || user?.email || '';
      const initUsername = defProfile?.username || user?.username || '';
      const initFirst = defProfile?.firstName || '';
      const initLast = defProfile?.lastName || '';
      const initPhone = defProfile?.phone || '';

      setEmail(initEmail);
      setUsername(initUsername);
      setFirstName(initFirst);
      setLastName(initLast);
      setPhone(initPhone);

      const initialPw = generatePassword(20, { upper: true, lower: true, nums: true, syms: true });
      setPassword(initialPw);
    } catch (e) {
      console.log('Init error', e);
    }
  };

  const handleApplyPreset = (mode) => {
    setProfileMode(mode);
    if (mode === 'default') {
      setEmail(defaultProfile?.email || user?.email || '');
      setUsername(defaultProfile?.username || user?.username || '');
      setFirstName(defaultProfile?.firstName || '');
      setLastName(defaultProfile?.lastName || '');
      setPhone(defaultProfile?.phone || '');
    } else {
      setEmail('');
      setUsername('');
      setFirstName('');
      setLastName('');
      setPhone('');
    }
  };

  const handleRegeneratePassword = (newLen = pwLength, opts = { upper: pwUpper, lower: pwLower, nums: pwNums, syms: pwSymbols }) => {
    const pw = generatePassword(newLen, opts);
    setPassword(pw);
  };

  const getPasswordStrength = () => {
    if (!password) return { label: 'Kein Passwort', color: colors.danger, progress: 0 };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 14) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 0.5;
    if (/[^A-Za-z0-9]/.test(password)) score += 0.5;

    if (score >= 3.5) return { label: 'Sehr sicher (Strong)', color: colors.success, progress: 1 };
    if (score >= 2.5) return { label: 'Sicher (Good)', color: colors.gold, progress: 0.75 };
    if (score >= 1.5) return { label: 'Mittel (Fair)', color: '#fbbf24', progress: 0.5 };
    return { label: 'Schwach (Weak)', color: colors.danger, progress: 0.25 };
  };

  const handleCreateCategory = async () => {
    const cleanName = newCategoryName.trim();
    if (!cleanName) return;
    try {
      const updatedCats = await saveCategory({ name: cleanName, icon: newCategoryIcon });
      setCategories(updatedCats);
      const created = updatedCats.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
      if (created) setSelectedCategory(created.id);
      setNewCategoryName('');
      setNewCategoryIcon('tag');
      setShowCategoryModal(false);
    } catch (e) {}
  };

  const handleSubmit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    if (!cleanPassword) {
      Alert.alert(t('error'), 'Bitte gib ein Passwort an oder generiere eines.');
      return;
    }

    const needsEmail = isFieldDetected('email');
    const needsUsername = isFieldDetected('username');

    if (needsEmail && !cleanEmail) {
      Alert.alert(t('error'), 'Bitte gib eine gültige E-Mail-Adresse an.');
      return;
    }
    if (needsUsername && !cleanUsername && !cleanEmail) {
      Alert.alert(t('error'), 'Bitte gib einen Benutzernamen an.');
      return;
    }
    if (!cleanEmail && !cleanUsername && !cleanFirstName) {
      Alert.alert(t('error'), 'Bitte fülle die erforderlichen Account-Angaben aus.');
      return;
    }

    setSubmitting(true);
    try {
      const primaryIdentifier = cleanEmail || cleanUsername || (cleanFirstName ? `${cleanFirstName} ${cleanLastName}`.trim() : domain);

      await saveCredentials(domain, primaryIdentifier, cleanPassword, {
        category: selectedCategory
      });

      if (profileMode === 'default') {
        await saveDefaultProfile({
          email: cleanEmail || defaultProfile?.email || '',
          username: cleanUsername || defaultProfile?.username || '',
          firstName: cleanFirstName || defaultProfile?.firstName || '',
          lastName: cleanLastName || defaultProfile?.lastName || '',
          phone: cleanPhone || defaultProfile?.phone || ''
        });
      }

      const payloadFields = {
        password: cleanPassword,
        confirmPassword: cleanPassword
      };

      if (cleanEmail) payloadFields.email = cleanEmail;
      if (cleanUsername) payloadFields.username = cleanUsername;
      if (cleanFirstName) payloadFields.firstName = cleanFirstName;
      if (cleanLastName) payloadFields.lastName = cleanLastName;
      if (cleanFirstName && cleanLastName) payloadFields.fullName = `${cleanFirstName} ${cleanLastName}`;
      if (cleanPhone) payloadFields.phone = cleanPhone;

      const payload = {
        action: 'register',
        type: 'register',
        fields: payloadFields
      };

      const encrypted = await encryptCredentials(payload, key);

      const res = await sendLogin(sid, encrypted);

      if (res && res.error) {
        throw new Error(res.error || 'Fehler beim Senden der Daten an den Browser');
      }

      Alert.alert(
        'Erfolgreich',
        `Zugangsdaten für ${domain} wurden sicher gespeichert und im Browser eingetragen.`,
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );
    } catch (err) {
      Alert.alert('Fehler', err.message || 'Registrierungsdaten konnten nicht übertragen werden.');
    } finally {
      setSubmitting(false);
    }
  };

  const strength = getPasswordStrength();

  const showEmailInput = isFieldDetected('email') || showExtraFields;
  const showUsernameInput = isFieldDetected('username') || showExtraFields;
  const showFirstNameInput = isFieldDetected('firstName') || isFieldDetected('fullName') || showExtraFields;
  const showLastNameInput = isFieldDetected('lastName') || showExtraFields;
  const showPhoneInput = isFieldDetected('phone') || showExtraFields;

  const hasHiddenExtraFields = hasSpecificSchema && (!isFieldDetected('username') || !isFieldDetected('phone') || !isFieldDetected('firstName'));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.gold }]}>‹ {t('common.back')}</Text>
          </TouchableOpacity>

          <View style={[styles.domainBadge, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
            <Text style={[styles.domainDot, { color: colors.gold }]}>●</Text>
            <Text style={[styles.domainText, { color: colors.gold }]}>{domain}</Text>
          </View>

          <Text style={[styles.title, { color: colors.textMain }]}>{t('registerFill.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSub }]}>{t('registerFill.subtitle')}</Text>

          {hasSpecificSchema && (
            <View style={[styles.detectedFieldsPill, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[styles.detectedFieldsText, { color: colors.textSub }]}>
                Von {domain} gefordert: {detectedFields.map(f => f.label || f.key).join(', ')}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.presetContainer, { backgroundColor: colors.inputBg }]}>
          <TouchableOpacity
            style={[
              styles.presetTab,
              profileMode === 'default' && [styles.presetTabActive, { backgroundColor: colors.goldBg, borderColor: colors.gold }]
            ]}
            onPress={() => handleApplyPreset('default')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.presetTabText,
              { color: profileMode === 'default' ? colors.gold : colors.textMuted },
              profileMode === 'default' && { fontWeight: '700' }
            ]}>
              {t('registerFill.standardProfile')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.presetTab,
              profileMode === 'custom' && [styles.presetTabActive, { backgroundColor: colors.goldBg, borderColor: colors.gold }]
            ]}
            onPress={() => handleApplyPreset('custom')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.presetTabText,
              { color: profileMode === 'custom' ? colors.gold : colors.textMuted },
              profileMode === 'custom' && { fontWeight: '700' }
            ]}>
              {t('registerFill.customProfile')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionTitle, { color: colors.textMuted }]}>{t('registerFill.accountDetails')}</Text>

          {(showFirstNameInput || showLastNameInput) && (
            <View style={styles.row}>
              {showFirstNameInput && (
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Vorname</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                    placeholder="Max"
                    placeholderTextColor={colors.textMuted}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              {showLastNameInput && (
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Nachname</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                    placeholder="Mustermann"
                    placeholderTextColor={colors.textMuted}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </View>
              )}
            </View>
          )}

          {showEmailInput && (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>E-Mail</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                placeholder="deine@email.de"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>
          )}

          {showUsernameInput && (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Benutzername</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                placeholder="benutzername"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {showPhoneInput && (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Telefonnummer</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                placeholder="+49 170 1234567"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          )}

          {hasHiddenExtraFields && (
            <TouchableOpacity
              style={styles.toggleExtraBtn}
              onPress={() => setShowExtraFields(!showExtraFields)}
            >
              <Text style={[styles.toggleExtraText, { color: colors.gold }]}>
                {showExtraFields ? '▲ Weniger Felder anzeigen' : '+ Weitere optionale Felder anzeigen'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.passwordHeader}>
            <Text style={[styles.cardSectionTitle, { color: colors.textMuted }]}>{t('registerFill.passwordSection')}</Text>
            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
              onPress={() => handleRegeneratePassword()}
            >
              <Text style={[styles.generateBtnText, { color: colors.gold }]}>{t('registerFill.regenerate')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
              onPress={() => setShowPassword(!showPassword)}
            >
              <AppIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} color={colors.gold} />
            </TouchableOpacity>
          </View>

          <View style={styles.strengthContainer}>
            <View style={[styles.strengthBarBg, { backgroundColor: colors.border }]}>
              <View style={[styles.strengthBarFill, { width: `${strength.progress * 100}%`, backgroundColor: strength.color }]} />
            </View>
            <Text style={[styles.strengthText, { color: strength.color }]}>{strength.label}</Text>
          </View>

          <TouchableOpacity
            style={styles.toggleSettingsBtn}
            onPress={() => setShowGeneratorOptions(!showGeneratorOptions)}
          >
            <Text style={[styles.toggleSettingsText, { color: colors.gold }]}>
              {t('registerFill.generatorSettings')} {showGeneratorOptions ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showGeneratorOptions && (
            <View style={[styles.generatorOptionsBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[styles.optionSectionLabel, { color: colors.textSub }]}>Länge: {pwLength} Zeichen</Text>
              <View style={styles.lengthChipsRow}>
                {[12, 16, 20, 24, 32].map((len) => (
                  <TouchableOpacity
                    key={len}
                    style={[
                      styles.lengthChip,
                      { backgroundColor: colors.cardBg, borderColor: colors.border },
                      pwLength === len && { backgroundColor: colors.gold, borderColor: colors.gold }
                    ]}
                    onPress={() => {
                      setPwLength(len);
                      handleRegeneratePassword(len);
                    }}
                  >
                    <Text style={[
                      styles.lengthChipText,
                      { color: colors.textSub },
                      pwLength === len && { color: '#ffffff', fontWeight: '800' }
                    ]}>
                      {len}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, { color: colors.textSub }]}>Großbuchstaben (A-Z)</Text>
                <Switch
                  value={pwUpper}
                  onValueChange={(val) => { setPwUpper(val); handleRegeneratePassword(pwLength, { upper: val, lower: pwLower, nums: pwNums, syms: pwSymbols }); }}
                  trackColor={{ false: colors.border, true: colors.gold }}
                />
              </View>

              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, { color: colors.textSub }]}>Kleinbuchstaben (a-z)</Text>
                <Switch
                  value={pwLower}
                  onValueChange={(val) => { setPwLower(val); handleRegeneratePassword(pwLength, { upper: pwUpper, lower: val, nums: pwNums, syms: pwSymbols }); }}
                  trackColor={{ false: colors.border, true: colors.gold }}
                />
              </View>

              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, { color: colors.textSub }]}>Zahlen (0-9)</Text>
                <Switch
                  value={pwNums}
                  onValueChange={(val) => { setPwNums(val); handleRegeneratePassword(pwLength, { upper: pwUpper, lower: pwLower, nums: val, syms: pwSymbols }); }}
                  trackColor={{ false: colors.border, true: colors.gold }}
                />
              </View>

              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, { color: colors.textSub }]}>Sonderzeichen (!@#$...)</Text>
                <Switch
                  value={pwSymbols}
                  onValueChange={(val) => { setPwSymbols(val); handleRegeneratePassword(pwLength, { upper: pwUpper, lower: pwLower, nums: pwNums, syms: val }); }}
                  trackColor={{ false: colors.border, true: colors.gold }}
                />
              </View>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionTitle, { color: colors.textMuted }]}>{t('credentials.categoryLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            <TouchableOpacity
              style={[
                styles.categoryChip,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
                !selectedCategory && { backgroundColor: colors.goldBg, borderColor: colors.gold }
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <AppIcon name="close" size={12} color={!selectedCategory ? colors.gold : colors.textMuted} />
              <Text style={[
                styles.categoryChipText,
                { color: colors.textSub },
                !selectedCategory && { color: colors.gold, fontWeight: '700' }
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
                    { backgroundColor: colors.inputBg, borderColor: colors.border },
                    isSelected && { backgroundColor: colors.goldBg, borderColor: colors.gold }
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <CategoryIcon name={cat.icon || 'tag'} size={14} color={isSelected ? colors.gold : colors.textSub} />
                  <Text style={[
                    styles.categoryChipText,
                    { color: colors.textSub },
                    isSelected && { color: colors.gold, fontWeight: '700' }
                  ]}>
                    {displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.newCategoryChip, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
              onPress={() => setShowCategoryModal(true)}
            >
              <AppIcon name="plus" size={12} color={colors.gold} />
              <Text style={[styles.newCategoryChipText, { color: colors.gold }]}>{t('credentials.addCategoryBtn')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={submitting ? ['#333', '#444'] : colors.goldGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {t('registerFill.saveAndFill')}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

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
  backBtn: { marginBottom: 14 },
  backText: { fontSize: 15, fontWeight: '700' },
  domainBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', marginBottom: 10
  },
  domainDot: { fontSize: 10 },
  domainText: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, lineHeight: 18 },

  detectedFieldsPill: {
    borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 12
  },
  detectedFieldsText: { fontSize: 12, fontWeight: '500' },

  presetContainer: {
    flexDirection: 'row', gap: 8,
    borderRadius: 8, padding: 4, marginBottom: 16
  },
  presetTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  presetTabActive: { borderWidth: 1 },
  presetTabText: { fontSize: 13, fontWeight: '600' },

  card: {
    borderWidth: 1,
    borderRadius: 10, padding: 18, marginBottom: 16
  },
  cardSectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },

  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14
  },
  row: { flexDirection: 'row', gap: 10 },

  toggleExtraBtn: { marginTop: 8, paddingVertical: 6 },
  toggleExtraText: { fontSize: 12, fontWeight: '700' },

  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  generateBtn: {
    borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6
  },
  generateBtnText: { fontSize: 12, fontWeight: '700' },
  passwordRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  passwordInput: { flex: 1 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center'
  },

  strengthContainer: { marginTop: 10, gap: 6 },
  strengthBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  strengthBarFill: { height: '100%', borderRadius: 2 },
  strengthText: { fontSize: 11, fontWeight: '600' },

  toggleSettingsBtn: { marginTop: 14, alignSelf: 'flex-start' },
  toggleSettingsText: { fontSize: 12, fontWeight: '700' },

  generatorOptionsBox: {
    marginTop: 12,
    borderRadius: 8, padding: 14, borderWidth: 1,
  },
  optionSectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  lengthChipsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  lengthChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1,
  },
  lengthChipText: { fontSize: 12, fontWeight: '600' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  optionLabel: { fontSize: 13 },

  categoryScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8
  },
  categoryChipText: { fontSize: 12 },
  newCategoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderStyle: 'dashed',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8
  },
  newCategoryChipText: { fontSize: 12, fontWeight: '700' },

  submitBtn: { borderRadius: 8, overflow: 'hidden', marginTop: 8 },
  submitGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 20
  },
  modalContent: {
    width: '100%', maxWidth: 360,
    borderWidth: 1, borderRadius: 10, padding: 20
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
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center'
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center'
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalSaveBtn: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  modalSaveGradient: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: '#ffffff', fontSize: 14, fontWeight: '800' }
});
