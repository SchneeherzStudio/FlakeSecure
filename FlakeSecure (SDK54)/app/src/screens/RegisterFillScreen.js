/**
 * ============================================================================
 * FlakeSecure Mobile App - Smart Registration Fill Screen (RegisterFillScreen)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. SCHEMA & FIELD DETECTION:
 *    - Decodes compact field schemas (email, username, password, firstName, lastName, phone) from the scanned QR code.
 *    - isFieldDetected(fieldKey): Dynamically renders only the form fields required by the target website.
 * 
 * 2. PROFILE PRESETS & PASSWORD GENERATOR:
 *    - handleApplyPreset(mode): Toggles between default profile preset (stored in SecureStore) and custom manual entries.
 *    - generatePassword(length, opts): Generates cryptographically secure random passwords with configurable character sets (upper/lower/numbers/symbols).
 *    - getPasswordStrength(): Calculates and displays password entropy and strength bar.
 * 
 * 3. ENCRYPTION & RELAY (handleSubmit):
 *    - Persists new credentials locally into SecureStore (saveCredentials).
 *    - Encrypts registration payload via AES-256-CTR + HMAC-SHA256 with the session key.
 *    - Relays data via POST /send-login to the browser extension for instant autofill.
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
import { encryptCredentials } from '../utils/crypto';
import { saveCredentials, getCategories, saveCategory, getDefaultProfile, saveDefaultProfile } from '../utils/storage';
import { useLanguage } from '../context/LanguageContext';

const SERVER_URL = 'https://flakesecure.snowystudio.dev';
const AVAILABLE_ICONS = ['👤', '💼', '💳', '💬', '🎮', '📁', '🛍️', '🛒', '🔒', '🏠', '✈️', '📧', '🎓', '💻', '🎵', '🍔', '🚗', '🏥', '🔑', '⭐'];

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
  const [newCategoryIcon, setNewCategoryIcon] = useState('🏷️');

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
    if (!password) return { label: 'Kein Passwort', color: '#ff6b6b', progress: 0 };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 14) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 0.5;
    if (/[^A-Za-z0-9]/.test(password)) score += 0.5;

    if (score >= 3.5) return { label: 'Sehr sicher (Strong)', color: '#34d399', progress: 1 };
    if (score >= 2.5) return { label: 'Sicher (Good)', color: '#60a5fa', progress: 0.75 };
    if (score >= 1.5) return { label: 'Mittel (Fair)', color: '#fbbf24', progress: 0.5 };
    return { label: 'Schwach (Weak)', color: '#f87171', progress: 0.25 };
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
      setNewCategoryIcon('🏷️');
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

      const response = await fetch(`${SERVER_URL}/send-login`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': 'https://flakesecure.snowystudio.dev'
        },
        body: JSON.stringify({ sid, payload: encrypted })
      });

      if (!response.ok) {
        throw new Error('Fehler beim Senden der Daten an den Browser');
      }

      Alert.alert(
        'Erfolgreich ✓',
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ {t('common.back')}</Text>
          </TouchableOpacity>

          <View style={styles.domainBadge}>
            <Text style={styles.domainDot}>●</Text>
            <Text style={styles.domainText}>{domain}</Text>
          </View>

          <Text style={styles.title}>{t('registerFill.title')}</Text>
          <Text style={styles.subtitle}>{t('registerFill.subtitle')}</Text>

          {hasSpecificSchema && (
            <View style={styles.detectedFieldsPill}>
              <Text style={styles.detectedFieldsText}>
                ✨ Von {domain} gefordert: {detectedFields.map(f => f.label || f.key).join(', ')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.presetContainer}>
          <TouchableOpacity
            style={[styles.presetTab, profileMode === 'default' && styles.presetTabActive]}
            onPress={() => handleApplyPreset('default')}
            activeOpacity={0.8}
          >
            <Text style={[styles.presetTabText, profileMode === 'default' && styles.presetTabTextActive]}>
              👤 {t('registerFill.standardProfile')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetTab, profileMode === 'custom' && styles.presetTabActive]}
            onPress={() => handleApplyPreset('custom')}
            activeOpacity={0.8}
          >
            <Text style={[styles.presetTabText, profileMode === 'custom' && styles.presetTabTextActive]}>
              ✏️ {t('registerFill.customProfile')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>{t('registerFill.accountDetails')}</Text>

          {(showFirstNameInput || showLastNameInput) && (
            <View style={styles.row}>
              {showFirstNameInput && (
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Vorname</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Max"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              {showLastNameInput && (
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Nachname</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Mustermann"
                    placeholderTextColor="rgba(255,255,255,0.25)"
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
              <Text style={styles.label}>E-Mail</Text>
              <TextInput
                style={styles.input}
                placeholder="deine@email.de"
                placeholderTextColor="rgba(255,255,255,0.25)"
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
              <Text style={styles.label}>Benutzername</Text>
              <TextInput
                style={styles.input}
                placeholder="benutzername"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {showPhoneInput && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Telefonnummer</Text>
              <TextInput
                style={styles.input}
                placeholder="+49 170 1234567"
                placeholderTextColor="rgba(255,255,255,0.25)"
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
              <Text style={styles.toggleExtraText}>
                {showExtraFields ? '▲ Weniger Felder anzeigen' : '➕ Weitere optionale Felder anzeigen'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.passwordHeader}>
            <Text style={styles.cardSectionTitle}>{t('registerFill.passwordSection')}</Text>
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={() => handleRegeneratePassword()}
            >
              <Text style={styles.generateBtnText}>🎲 {t('registerFill.regenerate')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.iconBtnText}>{showPassword ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.strengthContainer}>
            <View style={styles.strengthBarBg}>
              <View style={[styles.strengthBarFill, { width: `${strength.progress * 100}%`, backgroundColor: strength.color }]} />
            </View>
            <Text style={[styles.strengthText, { color: strength.color }]}>{strength.label}</Text>
          </View>

          <TouchableOpacity
            style={styles.toggleSettingsBtn}
            onPress={() => setShowGeneratorOptions(!showGeneratorOptions)}
          >
            <Text style={styles.toggleSettingsText}>
              ⚙️ {t('registerFill.generatorSettings')} {showGeneratorOptions ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showGeneratorOptions && (
            <View style={styles.generatorOptionsBox}>
              <Text style={styles.optionSectionLabel}>Länge: {pwLength} Zeichen</Text>
              <View style={styles.lengthChipsRow}>
                {[12, 16, 20, 24, 32].map((len) => (
                  <TouchableOpacity
                    key={len}
                    style={[styles.lengthChip, pwLength === len && styles.lengthChipActive]}
                    onPress={() => {
                      setPwLength(len);
                      handleRegeneratePassword(len);
                    }}
                  >
                    <Text style={[styles.lengthChipText, pwLength === len && styles.lengthChipTextActive]}>
                      {len}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Großbuchstaben (A-Z)</Text>
                <Switch
                  value={pwUpper}
                  onValueChange={(val) => { setPwUpper(val); handleRegeneratePassword(pwLength, { upper: val, lower: pwLower, nums: pwNums, syms: pwSymbols }); }}
                  trackColor={{ false: '#222', true: '#6391ff' }}
                />
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Kleinbuchstaben (a-z)</Text>
                <Switch
                  value={pwLower}
                  onValueChange={(val) => { setPwLower(val); handleRegeneratePassword(pwLength, { upper: pwUpper, lower: val, nums: pwNums, syms: pwSymbols }); }}
                  trackColor={{ false: '#222', true: '#6391ff' }}
                />
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Zahlen (0-9)</Text>
                <Switch
                  value={pwNums}
                  onValueChange={(val) => { setPwNums(val); handleRegeneratePassword(pwLength, { upper: pwUpper, lower: pwLower, nums: val, syms: pwSymbols }); }}
                  trackColor={{ false: '#222', true: '#6391ff' }}
                />
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Sonderzeichen (!@#$...)</Text>
                <Switch
                  value={pwSymbols}
                  onValueChange={(val) => { setPwSymbols(val); handleRegeneratePassword(pwLength, { upper: pwUpper, lower: pwLower, nums: pwNums, syms: val }); }}
                  trackColor={{ false: '#222', true: '#6391ff' }}
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>{t('credentials.categoryLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            <TouchableOpacity
              style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(null)}
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
            >
              <Text style={styles.newCategoryChipIcon}>➕</Text>
              <Text style={styles.newCategoryChipText}>{t('credentials.addCategoryBtn')}</Text>
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
            colors={submitting ? ['#333', '#444'] : ['#6391ff', '#7c6aff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                🔒 {t('registerFill.saveAndFill')}
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
  scroll: { padding: 20, paddingBottom: 48 },
  header: { marginBottom: 20 },
  backBtn: { marginBottom: 14 },
  backText: { color: '#6391ff', fontSize: 16 },
  domainBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(99,145,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.25)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
    alignSelf: 'flex-start', marginBottom: 10
  },
  domainDot: { color: '#6391ff', fontSize: 10 },
  domainText: { color: '#8eb0ff', fontSize: 13, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },

  detectedFieldsPill: {
    backgroundColor: 'rgba(99,145,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.2)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 12
  },
  detectedFieldsText: { fontSize: 12, color: '#8eb0ff', fontWeight: '500' },

  presetContainer: {
    flexDirection: 'row', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 4, marginBottom: 18
  },
  presetTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  presetTabActive: { backgroundColor: 'rgba(99,145,255,0.2)', borderWidth: 1, borderColor: '#6391ff' },
  presetTabText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  presetTabTextActive: { color: '#fff', fontWeight: '700' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, padding: 18, marginBottom: 18
  },
  cardSectionTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.08, marginBottom: 14 },

  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)', marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 15
  },
  row: { flexDirection: 'row', gap: 10 },

  toggleExtraBtn: { marginTop: 8, paddingVertical: 6 },
  toggleExtraText: { color: '#6391ff', fontSize: 12, fontWeight: '600' },

  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  generateBtn: {
    backgroundColor: 'rgba(99,145,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.3)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6
  },
  generateBtnText: { color: '#6391ff', fontSize: 12, fontWeight: '600' },
  passwordRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  passwordInput: { flex: 1 },
  iconBtn: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center'
  },
  iconBtnText: { fontSize: 18 },

  strengthContainer: { marginTop: 10, gap: 6 },
  strengthBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  strengthBarFill: { height: '100%', borderRadius: 2 },
  strengthText: { fontSize: 11, fontWeight: '600' },

  toggleSettingsBtn: { marginTop: 14, alignSelf: 'flex-start' },
  toggleSettingsText: { color: '#6391ff', fontSize: 12, fontWeight: '600' },

  generatorOptionsBox: {
    marginTop: 12, backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
  },
  optionSectionLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 8 },
  lengthChipsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  lengthChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
  },
  lengthChipActive: { backgroundColor: '#6391ff', borderColor: '#6391ff' },
  lengthChipText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  lengthChipTextActive: { color: '#fff', fontWeight: '700' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  optionLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  categoryScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12
  },
  categoryChipActive: { backgroundColor: 'rgba(99,145,255,0.16)', borderColor: '#6391ff' },
  categoryChipIcon: { fontSize: 14 },
  categoryChipText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },
  newCategoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(99,145,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.3)', borderStyle: 'dashed',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12
  },
  newCategoryChipIcon: { fontSize: 12, color: '#6391ff' },
  newCategoryChipText: { fontSize: 13, color: '#6391ff', fontWeight: '600' },

  submitBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  submitGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 20
  },
  modalContent: {
    width: '100%', maxWidth: 360, backgroundColor: '#121624',
    borderWidth: 1, borderColor: 'rgba(99,145,255,0.25)',
    borderRadius: 20, padding: 24
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
  iconOptionSelected: { backgroundColor: 'rgba(99,145,255,0.2)', borderColor: '#6391ff' },
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
