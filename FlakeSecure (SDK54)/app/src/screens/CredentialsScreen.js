/**
 * ============================================================================
 * FlakeSecure Mobile App - Create / Add Vault Entry Screen (CredentialsScreen) v2.1
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  saveCredentials,
  getCategories,
  saveCategory,
  getBankAccounts,
  saveBankAccount,
  saveCard,
  saveCode,
  CARD_COLOR_THEMES,
  CODE_CATEGORIES,
  detectCardBrand,
  getCardBrandDisplayName,
  validateLuhn,
  formatCardNumber,
  normalizeIban,
  formatIban,
  validateIban,
  lookupBankByIban,
  lookupBankByIbanOnline,
} from '../utils/storage';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
import {
  AppIcon,
  CategoryIcon,
  AVAILABLE_CATEGORY_ICONS,
} from '../components/CategoryIcons';

export default function CredentialsScreen({ route, navigation }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const toast = useToast();

  const prefillDomain = route.params?.prefillDomain || '';
  const initialType = route.params?.initialType || 'login';
  const prefillBankAccountId = route.params?.prefillBankAccountId || null;
  const initialCardSubMode = route.params?.cardSubMode || 'card'; // 'card' | 'accountOnly'

  const [entryType, setEntryType] = useState(
    ['login', 'card', 'code'].includes(initialType) ? initialType : 'login'
  );
  const [saving, setSaving] = useState(false);

  // Login fields
  const [domain, setDomain] = useState(prefillDomain);
  const [accountName, setAccountName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Bank Account + Bank Card fields
  const [cardSubMode, setCardSubMode] = useState(initialCardSubMode); // 'card' | 'accountOnly'
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState(
    prefillBankAccountId || null
  );
  const [bankAccountName, setBankAccountName] = useState('');
  const [cardLabel, setCardLabel] = useState('');
  const [cardIssuer, setCardIssuer] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [pin, setPin] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [autoDetectedInfo, setAutoDetectedInfo] = useState(null);
  const [userEditedBank, setUserEditedBank] = useState(false);
  const [userEditedBic, setUserEditedBic] = useState(false);
  const [cardColor, setCardColor] = useState('gold');
  const [cardNotes, setCardNotes] = useState('');
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Code fields
  const [codeLabel, setCodeLabel] = useState('');
  const [codeCategory, setCodeCategory] = useState('door');
  const [codeValue, setCodeValue] = useState('');
  const [codeLocation, setCodeLocation] = useState('');
  const [codeNotes, setCodeNotes] = useState('');

  // Categories
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('tag');

  useEffect(() => {
    loadCategories();
    loadBankAccountsList();
  }, []);

  const loadBankAccountsList = async () => {
    try {
      const list = await getBankAccounts();
      setBankAccounts(list);
      if (prefillBankAccountId) {
        const found = list.find((a) => a.id === prefillBankAccountId);
        if (found) {
          applySelectedBankAccount(found);
        }
      }
    } catch (e) {
      console.log('Failed to load bank accounts', e);
    }
  };

  const applySelectedBankAccount = (acc) => {
    if (!acc) {
      setSelectedBankAccountId(null);
      setBankAccountName('');
      setIban('');
      setBic('');
      setCardIssuer('');
      setAutoDetectedInfo(null);
      setUserEditedBank(false);
      setUserEditedBic(false);
      return;
    }
    setSelectedBankAccountId(acc.id);
    setBankAccountName(acc.name || '');
    setIban(acc.iban || '');
    setBic(acc.bic || '');
    setCardIssuer(acc.bankName || '');
    if (acc.holderName && !cardholderName.trim()) {
      setCardholderName(acc.holderName);
    }
    if (acc.color) {
      setCardColor(acc.color);
    }
    const detected = acc.iban ? lookupBankByIban(acc.iban) : null;
    setAutoDetectedInfo(detected?.detected ? detected : null);
  };

  const handleIbanChange = (rawText) => {
    const clean = normalizeIban(rawText);
    setIban(clean);

    // Check if this IBAN matches an existing bank account
    const matchingExisting = bankAccounts.find(
      (a) => a.iban && normalizeIban(a.iban) === clean && clean.length >= 15
    );
    if (matchingExisting && !selectedBankAccountId) {
      setSelectedBankAccountId(matchingExisting.id);
      if (!bankAccountName.trim() && matchingExisting.name) {
        setBankAccountName(matchingExisting.name);
      }
    }

    const result = lookupBankByIban(clean);
    if (result.detected) {
      setAutoDetectedInfo(result);
      if (result.bankName && !userEditedBank) {
        setCardIssuer(result.bankName);
      }
      if (result.bic && !userEditedBic) {
        setBic(result.bic);
      }
    } else {
      setAutoDetectedInfo(null);
    }

    // Non-blocking online enrichment for valid IBANs without exact offline BIC
    if (result.validation.isValid && (!result.exactMatch || !result.bic)) {
      lookupBankByIbanOnline(clean).then((onlineRes) => {
        if (onlineRes && onlineRes.detected) {
          setAutoDetectedInfo(onlineRes);
          if (onlineRes.bankName && !userEditedBank) {
            setCardIssuer(onlineRes.bankName);
          }
          if (onlineRes.bic && !userEditedBic) {
            setBic(onlineRes.bic);
          }
        }
      });
    }
  };

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
        setSelectedCategory(created.id);
      }
      setNewCategoryName('');
      setNewCategoryIcon('tag');
      setShowCategoryModal(false);
      toast.success(t('toast.saved'));
    } catch (e) {
      toast.error(t('error'), e.message || 'Failed to create category');
    }
  };

  const handleSave = async () => {
    if (entryType === 'login') {
      if (!domain.trim() || !username.trim() || !password.trim()) {
        toast.warn(t('error'), t('viewCredential.allFieldsRequired'));
        return;
      }

      let normalizedDomain = domain.trim().toLowerCase();
      normalizedDomain = normalizedDomain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0];

      setSaving(true);
      try {
        const savedCred = await saveCredentials(
          normalizedDomain,
          username.trim(),
          password,
          {
            name: accountName.trim(),
            category: selectedCategory,
            notes: notes.slice(0, 1000),
          }
        );
        toast.confirm({
          title: t('credentials.savedTitle'),
          message: t('credentials.savedMsg', { domain: normalizedDomain }),
          confirmText: t('credentials.add2faOfferBtn'),
          cancelText: t('ok'),
          icon: 'key',
          onConfirm: () => {
            navigation.replace('Authenticator', {
              prefillAdd: {
                domain: normalizedDomain,
                credId: savedCred.id,
                issuer: normalizedDomain,
                account: accountName.trim() || username.trim(),
                category: selectedCategory || 'other',
              },
            });
          },
          onCancel: () => {
            navigation.goBack();
          },
        });
      } catch (err) {
        toast.error(
          t('error'),
          t('viewCredential.saveFailed', { message: err.message })
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    if (entryType === 'card') {
      if (cardSubMode === 'accountOnly') {
        const cleanIbanVal = normalizeIban(iban);
        if (!bankAccountName.trim() && cleanIbanVal.length < 8) {
          toast.warn(t('error'), t('cards.missingAccountRequired'));
          return;
        }
        setSaving(true);
        try {
          await saveBankAccount({
            id: selectedBankAccountId || undefined,
            name:
              bankAccountName.trim() ||
              cardIssuer.trim() ||
              t('cards.defaultAccountName'),
            iban: cleanIbanVal,
            bic: bic.trim().toUpperCase(),
            bankName: cardIssuer.trim(),
            holderName: cardholderName.trim(),
            color: cardColor,
            notes: cardNotes.slice(0, 1000),
          });
          toast.success(t('cards.accountSavedToast'));
          navigation.navigate('Home', { initialSegment: 'cards' });
        } catch (err) {
          toast.error(
            t('error'),
            t('viewCredential.saveFailed', { message: err.message })
          );
        } finally {
          setSaving(false);
        }
        return;
      }

      const cleanNumber = cardNumber.replace(/\D/g, '');
      if (!cardLabel.trim() || cleanNumber.length < 8) {
        toast.warn(t('error'), t('cards.missingRequired'));
        return;
      }
      setSaving(true);
      try {
        await saveCard({
          accountId: selectedBankAccountId || undefined,
          accountName:
            bankAccountName.trim() ||
            cardIssuer.trim() ||
            t('cards.defaultAccountName'),
          label: cardLabel.trim(),
          issuer: cardIssuer.trim(),
          cardholderName: cardholderName.trim(),
          number: cleanNumber,
          expiryMonth: expiryMonth.trim(),
          expiryYear: expiryYear.trim(),
          cvv: cvv.trim(),
          pin: pin.trim(),
          iban: normalizeIban(iban),
          bic: bic.trim().toUpperCase(),
          color: cardColor,
          notes: cardNotes.slice(0, 1000),
        });
        toast.success(t('cards.savedToast'));
        navigation.navigate('Home', { initialSegment: 'cards' });
      } catch (err) {
        toast.error(
          t('error'),
          t('viewCredential.saveFailed', { message: err.message })
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    if (entryType === 'code') {
      if (!codeLabel.trim() || !codeValue.trim()) {
        toast.warn(t('error'), t('codes.missingRequired'));
        return;
      }
      setSaving(true);
      try {
        await saveCode({
          label: codeLabel.trim(),
          code: codeValue.trim(),
          codeCategory,
          location: codeLocation.trim(),
          notes: codeNotes.slice(0, 1000),
        });
        toast.success(t('codes.savedToast'));
        navigation.navigate('Home', { initialSegment: 'codes' });
      } catch (err) {
        toast.error(
          t('error'),
          t('viewCredential.saveFailed', { message: err.message })
        );
      } finally {
        setSaving(false);
      }
    }
  };

  const detectedBrand = detectCardBrand(cardNumber);
  const brandDisplay = getCardBrandDisplayName(detectedBrand);
  const cleanCardDigits = cardNumber.replace(/\D/g, '');
  const isLuhnChecked = cleanCardDigits.length >= 12;
  const isLuhnValid = isLuhnChecked ? validateLuhn(cleanCardDigits) : false;
  const ibanValidation = validateIban(iban);
  const activeCardTheme =
    CARD_COLOR_THEMES[cardColor] || CARD_COLOR_THEMES.gold;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <Text style={[styles.backText, { color: colors.gold }]}>
                ‹ {t('common.back')}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.textMain }]}>
              {entryType === 'card'
                ? t('cards.newCardTitle')
                : entryType === 'code'
                ? t('codes.newCodeTitle')
                : t('credentials.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSub }]}>
              {t('credentials.subtitle')}
            </Text>
          </View>

          {/* 3-Type Switcher: Login | Bankkarte | Code */}
          <View
            style={[
              styles.typeSwitcher,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            {[
              { key: 'login', label: 'Login', icon: 'lock' },
              { key: 'card', label: t('cards.typeLabel'), icon: 'card' },
              { key: 'code', label: t('codes.typeLabel'), icon: 'keypad' },
            ].map((item) => {
              const selected = entryType === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.typeTab,
                    selected && { backgroundColor: colors.gold },
                  ]}
                  onPress={() => setEntryType(item.key)}
                  activeOpacity={0.8}
                >
                  <CategoryIcon
                    name={item.icon}
                    size={15}
                    color={selected ? '#ffffff' : colors.gold}
                  />
                  <Text
                    style={[
                      styles.typeTabText,
                      { color: selected ? '#ffffff' : colors.textSub },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: colors.goldBg,
                borderColor: colors.goldBorder,
              },
            ]}
          >
            <AppIcon name="lock" size={20} color={colors.gold} />
            <View style={styles.infoText}>
              <Text style={[styles.infoTitle, { color: colors.gold }]}>
                {t('credentials.encryptionInfoTitle')}
              </Text>
              <Text style={[styles.infoDesc, { color: colors.textSub }]}>
                {t('credentials.encryptionInfoDesc')}
              </Text>
            </View>
          </View>

          {entryType === 'login' && (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {t('credentials.domainLabel')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textMain,
                    },
                  ]}
                  placeholder={t('credentials.domainPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={domain}
                  onChangeText={setDomain}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  {t('credentials.domainHint')}
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {t('credentials.accountNameLabel')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textMain,
                    },
                  ]}
                  placeholder={t('credentials.accountNamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={accountName}
                  onChangeText={setAccountName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  {t('credentials.accountNameHint')}
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {t('credentials.usernameLabel')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textMain,
                    },
                  ]}
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
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {t('credentials.passwordLabel')}
                </Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                        color: colors.textMain,
                      },
                    ]}
                    placeholder={t('credentials.passwordPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[
                      styles.showBtn,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <AppIcon
                      name={showPassword ? 'eyeOff' : 'eye'}
                      size={18}
                      color={colors.gold}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.notesLabelRow}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <AppIcon name="note" size={13} color={colors.gold} />
                    <Text style={[styles.label, { color: colors.textMuted }]}>
                      {t('credentials.notesLabel')}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.charCounter,
                      {
                        color:
                          notes.length >= 950 ? colors.gold : colors.textMuted,
                      },
                    ]}
                  >
                    {notes.length}/1000
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    styles.notesInput,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textMain,
                    },
                  ]}
                  placeholder={t('credentials.notesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={notes}
                  onChangeText={(txt) => setNotes(txt.slice(0, 1000))}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {t('credentials.categoryLabel')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  <TouchableOpacity
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                      !selectedCategory && {
                        backgroundColor: colors.goldBg,
                        borderColor: colors.gold,
                      },
                    ]}
                    onPress={() => setSelectedCategory(null)}
                    activeOpacity={0.7}
                  >
                    <AppIcon
                      name="close"
                      size={12}
                      color={!selectedCategory ? colors.gold : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        {
                          color: !selectedCategory
                            ? colors.gold
                            : colors.textSub,
                        },
                      ]}
                    >
                      {t('credentials.categoryNone')}
                    </Text>
                  </TouchableOpacity>

                  {categories.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    const displayName = cat.isDefault
                      ? t(`categories.${cat.id}`) || cat.name
                      : cat.name;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: colors.cardBg,
                            borderColor: colors.border,
                          },
                          isSelected && {
                            backgroundColor: colors.goldBg,
                            borderColor: colors.gold,
                          },
                        ]}
                        onPress={() => setSelectedCategory(cat.id)}
                        activeOpacity={0.7}
                      >
                        <CategoryIcon
                          name={cat.icon || 'tag'}
                          size={14}
                          color={isSelected ? colors.gold : colors.textSub}
                        />
                        <Text
                          style={[
                            styles.categoryChipText,
                            {
                              color: isSelected ? colors.gold : colors.textSub,
                            },
                          ]}
                        >
                          {displayName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={[
                      styles.newCategoryChip,
                      {
                        backgroundColor: colors.goldBg,
                        borderColor: colors.goldBorder,
                      },
                    ]}
                    onPress={() => setShowCategoryModal(true)}
                    activeOpacity={0.7}
                  >
                    <AppIcon name="plus" size={12} color={colors.gold} />
                    <Text
                      style={[
                        styles.newCategoryChipText,
                        { color: colors.gold },
                      ]}
                    >
                      {t('credentials.addCategoryBtn')}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          )}

          {entryType === 'card' && (
            <View style={styles.form}>
              {/* Sub-mode Switcher: Karte zu Konto hinzufügen | Nur Bankkonto anlegen */}
              <View
                style={[
                  styles.subModeRow,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.subModeBtn,
                    cardSubMode === 'card' && {
                      backgroundColor: colors.goldBg,
                      borderColor: colors.gold,
                    },
                  ]}
                  onPress={() => setCardSubMode('card')}
                  activeOpacity={0.8}
                >
                  <CategoryIcon
                    name="card"
                    size={14}
                    color={cardSubMode === 'card' ? colors.gold : colors.textSub}
                  />
                  <Text
                    style={[
                      styles.subModeBtnText,
                      {
                        color:
                          cardSubMode === 'card' ? colors.gold : colors.textSub,
                      },
                    ]}
                  >
                    {t('cards.modeCardForAccount')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.subModeBtn,
                    cardSubMode === 'accountOnly' && {
                      backgroundColor: colors.goldBg,
                      borderColor: colors.gold,
                    },
                  ]}
                  onPress={() => setCardSubMode('accountOnly')}
                  activeOpacity={0.8}
                >
                  <CategoryIcon
                    name="briefcase"
                    size={14}
                    color={
                      cardSubMode === 'accountOnly'
                        ? colors.gold
                        : colors.textSub
                    }
                  />
                  <Text
                    style={[
                      styles.subModeBtnText,
                      {
                        color:
                          cardSubMode === 'accountOnly'
                            ? colors.gold
                            : colors.textSub,
                      },
                    ]}
                  >
                    {t('cards.modeAccountOnly')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Live Stylized Card Preview */}
              {cardSubMode === 'card' && (
                <LinearGradient
                  colors={activeCardTheme.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.liveCardPreview,
                    { borderColor: activeCardTheme.border },
                  ]}
                >
                  <View style={styles.liveCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.liveCardTitle} numberOfLines={1}>
                        {cardLabel.trim() || t('cards.newCardTitle')}
                      </Text>
                      <Text style={styles.liveCardIssuer} numberOfLines={1}>
                        {[
                          bankAccountName.trim(),
                          cardIssuer.trim(),
                          bic.trim(),
                        ]
                          .filter(Boolean)
                          .join(' • ') || t('cards.accountSectionTitle')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.liveBrandBadge,
                        { borderColor: activeCardTheme.accent + '66' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.liveBrandText,
                          { color: activeCardTheme.accent },
                        ]}
                      >
                        {brandDisplay}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.liveCardNumberRow}>
                    <AppIcon
                      name="chip"
                      size={26}
                      color={activeCardTheme.accent}
                    />
                    <Text style={styles.liveCardNumberText}>
                      {cardNumber
                        ? formatCardNumber(cardNumber, false)
                        : '•••• •••• •••• ••••'}
                    </Text>
                  </View>

                  {!!iban && (
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.72)',
                        fontSize: 11,
                        fontWeight: '600',
                        letterSpacing: 1,
                        marginBottom: 12,
                      }}
                      numberOfLines={1}
                    >
                      IBAN: {formatIban(iban, false)}
                    </Text>
                  )}

                  <View style={styles.liveCardBottom}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.liveCardCaption}>
                        {t('cards.cardholderName')}
                      </Text>
                      <Text style={styles.liveCardValue} numberOfLines={1}>
                        {cardholderName.trim() || 'MAX MUSTERMANN'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.liveCardCaption}>
                        {t('cards.validThru')}
                      </Text>
                      <Text style={styles.liveCardValue}>
                        {expiryMonth || 'MM'}/{expiryYear || 'YY'}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              )}

              {/* BANK ACCOUNT SECTION: Kontoname, IBAN & Auto-BIC/Bank Detection */}
              <View
                style={[
                  styles.bankAccountBox,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.goldBorder,
                  },
                ]}
              >
                <View style={styles.bankAccountBoxHeader}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <CategoryIcon
                      name="briefcase"
                      size={16}
                      color={colors.gold}
                    />
                    <Text
                      style={[
                        styles.bankAccountBoxTitle,
                        { color: colors.textMain },
                      ]}
                    >
                      {t('cards.accountSectionTitle')}
                    </Text>
                  </View>
                  {autoDetectedInfo?.detected && (
                    <View
                      style={[
                        styles.autoDetectBadge,
                        {
                          backgroundColor: 'rgba(16, 185, 129, 0.14)',
                          borderColor: 'rgba(16, 185, 129, 0.45)',
                        },
                      ]}
                    >
                      <AppIcon name="check-circle" size={11} color="#10b981" />
                      <Text style={styles.autoDetectBadgeText}>
                        {t('cards.autoDetectedBadge')}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={[
                    styles.bankAccountBoxSub,
                    { color: colors.textSub },
                  ]}
                >
                  {t('cards.accountSectionSub')}
                </Text>

                {bankAccounts.length > 0 && (
                  <View style={{ marginBottom: 6 }}>
                    <Text
                      style={[
                        styles.label,
                        { color: colors.textMuted, marginBottom: 6 },
                      ]}
                    >
                      {t('cards.selectExistingAccount')}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryScroll}
                    >
                      <TouchableOpacity
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.border,
                          },
                          !selectedBankAccountId && {
                            backgroundColor: colors.goldBg,
                            borderColor: colors.gold,
                          },
                        ]}
                        onPress={() => applySelectedBankAccount(null)}
                      >
                        <AppIcon
                          name="plus"
                          size={12}
                          color={
                            !selectedBankAccountId
                              ? colors.gold
                              : colors.textSub
                          }
                        />
                        <Text
                          style={[
                            styles.categoryChipText,
                            {
                              color: !selectedBankAccountId
                                ? colors.gold
                                : colors.textSub,
                            },
                          ]}
                        >
                          {t('cards.newAccountChip')}
                        </Text>
                      </TouchableOpacity>

                      {bankAccounts.map((acc) => {
                        const isSel = selectedBankAccountId === acc.id;
                        const shortIban = acc.iban
                          ? `••${acc.iban.slice(-4)}`
                          : '';
                        return (
                          <TouchableOpacity
                            key={acc.id}
                            style={[
                              styles.categoryChip,
                              {
                                backgroundColor: colors.inputBg,
                                borderColor: colors.border,
                              },
                              isSel && {
                                backgroundColor: colors.goldBg,
                                borderColor: colors.gold,
                              },
                            ]}
                            onPress={() => applySelectedBankAccount(acc)}
                          >
                            <CategoryIcon
                              name="card"
                              size={12}
                              color={isSel ? colors.gold : colors.textSub}
                            />
                            <Text
                              style={[
                                styles.categoryChipText,
                                {
                                  color: isSel ? colors.gold : colors.textMain,
                                },
                              ]}
                            >
                              {acc.name}
                              {shortIban ? ` (${shortIban})` : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>
                    {t('cards.accountNameLabel')}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                        color: colors.textMain,
                      },
                    ]}
                    placeholder={t('cards.accountNamePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={bankAccountName}
                    onChangeText={setBankAccountName}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <View style={styles.notesLabelRow}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>
                      {t('cards.iban')}
                    </Text>
                    {ibanValidation.country ? (
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: ibanValidation.isChecked
                            ? ibanValidation.isValid
                              ? '#10b981'
                              : '#f59e0b'
                            : colors.textMuted,
                        }}
                      >
                        {ibanValidation.country} • {ibanValidation.currentLength}
                        {ibanValidation.expectedLength
                          ? `/${ibanValidation.expectedLength}`
                          : ''}
                      </Text>
                    ) : null}
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: ibanValidation.isChecked
                          ? ibanValidation.isValid
                            ? '#10b981'
                            : '#f59e0b'
                          : colors.border,
                        color: colors.textMain,
                        letterSpacing: 1,
                        fontWeight: '700',
                      },
                    ]}
                    placeholder={t('cards.ibanPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={formatIban(iban, false)}
                    onChangeText={handleIbanChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {ibanValidation.isChecked && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 2,
                      }}
                    >
                      <AppIcon
                        name={
                          ibanValidation.isValid ? 'check-circle' : 'alert'
                        }
                        size={13}
                        color={ibanValidation.isValid ? '#10b981' : '#f59e0b'}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: ibanValidation.isValid
                            ? '#10b981'
                            : '#f59e0b',
                        }}
                      >
                        {ibanValidation.isValid
                          ? t('cards.ibanValid')
                          : t('cards.ibanInvalid')}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.fieldGroup, { flex: 1.3 }]}>
                    <View style={styles.notesLabelRow}>
                      <Text style={[styles.label, { color: colors.textMuted }]}>
                        {t('cards.issuer')}
                      </Text>
                      {autoDetectedInfo?.bankName && !userEditedBank && (
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '800',
                            color: '#10b981',
                          }}
                        >
                          AUTO
                        </Text>
                      )}
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor:
                            autoDetectedInfo?.bankName && !userEditedBank
                              ? 'rgba(16, 185, 129, 0.5)'
                              : colors.border,
                          color: colors.textMain,
                        },
                      ]}
                      placeholder={t('cards.issuerPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={cardIssuer}
                      onChangeText={(v) => {
                        setUserEditedBank(true);
                        setCardIssuer(v);
                      }}
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <View style={styles.notesLabelRow}>
                      <Text style={[styles.label, { color: colors.textMuted }]}>
                        {t('cards.bic')}
                      </Text>
                      {autoDetectedInfo?.bic && !userEditedBic && (
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '800',
                            color: '#10b981',
                          }}
                        >
                          AUTO
                        </Text>
                      )}
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor:
                            autoDetectedInfo?.bic && !userEditedBic
                              ? 'rgba(16, 185, 129, 0.5)'
                              : colors.border,
                          color: colors.textMain,
                          fontWeight: '700',
                        },
                      ]}
                      placeholder={t('cards.bicPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={bic}
                      onChangeText={(v) => {
                        setUserEditedBic(true);
                        setBic(v.replace(/\s+/g, '').toUpperCase().slice(0, 11));
                      }}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {t('cards.cardholderName')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textMain,
                    },
                  ]}
                  placeholder={t('cards.cardholderPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={cardholderName}
                  onChangeText={setCardholderName}
                  autoCapitalize="characters"
                />
              </View>

              {cardSubMode === 'card' && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>
                      {t('cards.labelField')}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.border,
                          color: colors.textMain,
                        },
                      ]}
                      placeholder={t('cards.labelPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={cardLabel}
                      onChangeText={setCardLabel}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <View style={styles.notesLabelRow}>
                      <Text style={[styles.label, { color: colors.textMuted }]}>
                        {t('cards.cardNumber')}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: colors.gold,
                        }}
                      >
                        {brandDisplay}
                      </Text>
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: isLuhnChecked
                            ? isLuhnValid
                              ? '#10b981'
                              : '#f59e0b'
                            : colors.border,
                          color: colors.textMain,
                          letterSpacing: 1.5,
                          fontWeight: '700',
                        },
                      ]}
                      placeholder={t('cards.cardNumberPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={formatCardNumber(cardNumber, false)}
                      onChangeText={(txt) =>
                        setCardNumber(txt.replace(/\D/g, '').slice(0, 19))
                      }
                      keyboardType="number-pad"
                    />
                    {isLuhnChecked && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 2,
                        }}
                      >
                        <AppIcon
                          name={isLuhnValid ? 'check-circle' : 'alert'}
                          size={13}
                          color={isLuhnValid ? '#10b981' : '#f59e0b'}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: isLuhnValid ? '#10b981' : '#f59e0b',
                          }}
                        >
                          {isLuhnValid
                            ? t('cards.luhnValid')
                            : t('cards.luhnInvalid')}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={[styles.label, { color: colors.textMuted }]}>
                        {t('cards.expiryMonth')}
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.border,
                            color: colors.textMain,
                            textAlign: 'center',
                          },
                        ]}
                        placeholder="MM"
                        placeholderTextColor={colors.textMuted}
                        value={expiryMonth}
                        onChangeText={(v) =>
                          setExpiryMonth(v.replace(/\D/g, '').slice(0, 2))
                        }
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                    </View>

                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={[styles.label, { color: colors.textMuted }]}>
                        {t('cards.expiryYear')}
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.border,
                            color: colors.textMain,
                            textAlign: 'center',
                          },
                        ]}
                        placeholder="YY"
                        placeholderTextColor={colors.textMuted}
                        value={expiryYear}
                        onChangeText={(v) =>
                          setExpiryYear(v.replace(/\D/g, '').slice(0, 2))
                        }
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                    </View>

                    <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                      <Text style={[styles.label, { color: colors.textMuted }]}>
                        {t('cards.cvv')}
                      </Text>
                      <View style={styles.passwordRow}>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              backgroundColor: colors.inputBg,
                              borderColor: colors.border,
                              color: colors.textMain,
                              textAlign: 'center',
                            },
                          ]}
                          placeholder={t('cards.cvvPlaceholder')}
                          placeholderTextColor={colors.textMuted}
                          value={cvv}
                          onChangeText={(v) =>
                            setCvv(v.replace(/\D/g, '').slice(0, 4))
                          }
                          keyboardType="number-pad"
                          secureTextEntry={!showCvv}
                          maxLength={4}
                        />
                        <TouchableOpacity
                          style={[
                            styles.showBtn,
                            {
                              backgroundColor: colors.inputBg,
                              borderColor: colors.border,
                            },
                          ]}
                          onPress={() => setShowCvv(!showCvv)}
                        >
                          <AppIcon
                            name={showCvv ? 'eyeOff' : 'eye'}
                            size={16}
                            color={colors.gold}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>
                      {t('cards.pin')}
                    </Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[
                          styles.input,
                          styles.passwordInput,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.border,
                            color: colors.textMain,
                          },
                        ]}
                        placeholder={t('cards.pinPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={pin}
                        onChangeText={(v) =>
                          setPin(v.replace(/\D/g, '').slice(0, 8))
                        }
                        keyboardType="number-pad"
                        secureTextEntry={!showPin}
                        maxLength={8}
                      />
                      <TouchableOpacity
                        style={[
                          styles.showBtn,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => setShowPin(!showPin)}
                      >
                        <AppIcon
                          name={showPin ? 'eyeOff' : 'eye'}
                          size={18}
                          color={colors.gold}
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.pinWarningBox}>
                      <AppIcon name="pin-warning" size={18} color="#f59e0b" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pinWarningTitle}>
                          {t('cards.pinWarningTitle')}
                        </Text>
                        <Text
                          style={[
                            styles.pinWarningText,
                            { color: colors.textSub },
                          ]}
                        >
                          {t('cards.pinWarningText')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {t('cards.colorTheme')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  {Object.values(CARD_COLOR_THEMES).map((themeObj) => {
                    const selected = cardColor === themeObj.id;
                    return (
                      <TouchableOpacity
                        key={themeObj.id}
                        style={[
                          styles.colorSwatchBtn,
                          {
                            backgroundColor: themeObj.gradient[0],
                            borderColor: selected
                              ? '#ffffff'
                              : themeObj.border,
                            borderWidth: selected ? 2 : 1,
                          },
                        ]}
                        onPress={() => setCardColor(themeObj.id)}
                      >
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: themeObj.accent },
                          ]}
                        />
                        <Text style={styles.colorSwatchLabel}>
                          {t(themeObj.labelKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.notesLabelRow}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>
                    {t('credentials.notesLabel')}
                  </Text>
                  <Text
                    style={[styles.charCounter, { color: colors.textMuted }]}
                  >
                    {cardNotes.length}/1000
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    styles.notesInput,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textMain,
                    },
                  ]}
                  placeholder={t('credentials.notesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={cardNotes}
                  onChangeText={(txt) => setCardNotes(txt.slice(0, 1000))}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
              </View>
            </View>
          )}

          {entryType === 'code' && (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {t('codes.categoryField')}
                </Text>
                <View style={styles.codeCatGrid}>
                  {CODE_CATEGORIES.map((cc) => {
                    const isSelected = codeCategory === cc.id;
                    return (
                      <TouchableOpacity
                        key={cc.id}
                        style={[
                          styles.codeCatCard,
                          {
                            backgroundColor: colors.cardBg,
                            borderColor: colors.border,
                          },
                          isSelected && {
                            backgroundColor: colors.goldBg,
                            borderColor: colors.gold,
                          },
                        ]}
                        onPress={() => setCodeCategory(cc.id)}
                        activeOpacity={0.75}
                      >
                        <CategoryIcon
                          name={cc.icon}
                          size={20}
                          color={isSelected ? colors.gold : colors.textSub}
                        />
                        <Text
                          style={[
                            styles.codeCatText,
                            {
                              color: isSelected
                                ? colors.gold
                                : colors.textMain,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {t(cc.labelKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {t('codes.labelField')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textMain,
                    },
                  ]}
                  placeholder={t('codes.labelPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={codeLabel}
                  onChangeText={setCodeLabel}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {t('codes.codeField')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.goldBorder,
                      color: colors.gold,
                      fontSize: 18,
                      fontWeight: '800',
                      letterSpacing: 2,
                    },
                  ]}
                  placeholder={t('codes.codePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={codeValue}
                  onChangeText={setCodeValue}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {t('codes.locationField')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textMain,
                    },
                  ]}
                  placeholder={t('codes.locationPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={codeLocation}
                  onChangeText={setCodeLocation}
                />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.notesLabelRow}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>
                    {t('credentials.notesLabel')}
                  </Text>
                  <Text
                    style={[styles.charCounter, { color: colors.textMuted }]}
                  >
                    {codeNotes.length}/1000
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    styles.notesInput,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textMain,
                    },
                  ]}
                  placeholder={t('credentials.notesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={codeNotes}
                  onChangeText={(txt) => setCodeNotes(txt.slice(0, 1000))}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
              </View>
            </View>
          )}

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
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.textMain }]}>
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
                  borderColor: colors.border,
                  color: colors.textMain,
                },
              ]}
              placeholder={t('categories.categoryNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoCapitalize="words"
            />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>
              {t('categories.selectIcon')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.iconPickerScroll}
            >
              <View style={styles.iconPickerRow}>
                {AVAILABLE_CATEGORY_ICONS.map((iconKey) => {
                  const isSelected = newCategoryIcon === iconKey;
                  return (
                    <TouchableOpacity
                      key={iconKey}
                      style={[
                        styles.iconOption,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.border,
                        },
                        isSelected && {
                          backgroundColor: colors.goldBg,
                          borderColor: colors.gold,
                        },
                      ]}
                      onPress={() => setNewCategoryIcon(iconKey)}
                    >
                      <CategoryIcon
                        name={iconKey}
                        size={18}
                        color={isSelected ? colors.gold : colors.textSub}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSub }]}>
                  {t('cancel')}
                </Text>
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
  header: { marginBottom: 16 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 15, fontWeight: '700' },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: { fontSize: 13 },
  typeSwitcher: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  subModeRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    gap: 6,
  },
  subModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bankAccountBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  bankAccountBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankAccountBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  bankAccountBoxSub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: -6,
  },
  autoDetectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  autoDetectBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 7,
    gap: 6,
  },
  typeTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
  },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  infoDesc: { fontSize: 12, lineHeight: 17 },
  form: { gap: 16, marginBottom: 24 },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    flex: 1,
  },
  hint: { fontSize: 11, marginTop: 2 },
  passwordRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  passwordInput: { flex: 1 },
  showBtn: {
    borderWidth: 1,
    borderRadius: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  charCounter: {
    fontSize: 11,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 84,
    paddingTop: 12,
  },
  categoryScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  categoryChipText: { fontSize: 12, fontWeight: '600' },
  newCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newCategoryChipText: { fontSize: 12, fontWeight: '700' },
  // Live Bank Card Preview
  liveCardPreview: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 4,
  },
  liveCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  liveCardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  liveCardIssuer: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    marginTop: 2,
  },
  liveBrandBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  liveBrandText: {
    fontSize: 11,
    fontWeight: '800',
  },
  liveCardNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  liveCardNumberText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 2,
  },
  liveCardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  liveCardCaption: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  liveCardValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  pinWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.42)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  pinWarningTitle: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  pinWarningText: {
    fontSize: 11,
    lineHeight: 16,
  },
  colorSwatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  colorSwatchLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Code Category Grid
  codeCatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  codeCatCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  codeCatText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  saveButton: { borderRadius: 8, overflow: 'hidden' },
  saveGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 14,
  },
  iconPickerScroll: { marginBottom: 16 },
  iconPickerRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalSaveBtn: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  modalSaveGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
