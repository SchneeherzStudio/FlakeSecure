/**
 * ============================================================================
 * FlakeSecure Mobile App - View & Edit Credential / Card / Code Screen v2.1
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import {
  getCredentialsForDomain,
  saveCredentials,
  getCategories,
  saveCategory,
  getNote,
  getTotpItems,
  getBankAccounts,
  getBankAccountById,
  saveBankAccount,
  deleteBankAccount,
  getCardById,
  saveCard,
  deleteCard,
  getCodeById,
  saveCode,
  deleteCode,
  CARD_COLOR_THEMES,
  CODE_CATEGORIES,
  detectCardBrand,
  getCardBrandDisplayName,
  validateLuhn,
  formatCardNumber,
  getCardExpiryStatus,
  normalizeIban,
  formatIban,
  validateIban,
  lookupBankByIban,
  lookupBankByIbanOnline,
} from '../utils/storage';
import { generateTOTP, getRemainingSeconds } from '../utils/totp';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
import {
  AppIcon,
  CategoryIcon,
  AVAILABLE_CATEGORY_ICONS,
} from '../components/CategoryIcons';
import FaviconImage from '../components/FaviconImage';
import { DetailFieldSkeleton } from '../components/Skeleton';
import { TapFeedback } from '../components/TapFeedback';

export default function ViewCredentialScreen({ route, navigation }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const toast = useToast();

  const itemType =
    route.params?.itemType ||
    (route.params?.bankAccountId
      ? 'bankAccount'
      : route.params?.cardId
      ? 'card'
      : route.params?.codeId
      ? 'code'
      : 'login');
  const domain = route.params?.domain || '';
  const initialId = route.params?.id || null;
  const bankAccountId = route.params?.bankAccountId || null;
  const cardId = route.params?.cardId || null;
  const codeId = route.params?.codeId || null;

  const [activeId, setActiveId] = useState(
    initialId || bankAccountId || cardId || codeId
  );
  const [accountName, setAccountName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');

  // Bank Account + Bank Card state
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState(null);
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
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Code state
  const [codeLabel, setCodeLabel] = useState('');
  const [codeValue, setCodeValue] = useState('');
  const [codeCategory, setCodeCategory] = useState('door');
  const [codeLocation, setCodeLocation] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isHidden, setIsHidden] = useState(false);

  const [linkedTotp, setLinkedTotp] = useState(null);
  const [, setTotpTick] = useState(0);

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('tag');

  useEffect(() => {
    authenticateAndLoad();
  }, []);

  const refreshLinkedTotp = useCallback(
    async (credIdToMatch) => {
      if (itemType !== 'login') return;
      const idTarget = credIdToMatch || activeId;
      if (!idTarget) return;
      try {
        const items = await getTotpItems();
        const found = items.find((it) => it.credId === idTarget) || null;
        setLinkedTotp(found);
      } catch {}
    },
    [activeId, itemType]
  );

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && activeId && itemType === 'login') {
        refreshLinkedTotp(activeId);
      }
    }, [isAuthenticated, activeId, itemType, refreshLinkedTotp])
  );

  useEffect(() => {
    if (!isAuthenticated || !linkedTotp) return;
    const timer = setInterval(() => {
      setTotpTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isAuthenticated, linkedTotp]);

  const authenticateAndLoad = async () => {
    setLoading(true);
    setAuthError('');
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHw && enrolled) {
        const promptTarget =
          itemType === 'bankAccount'
            ? t('cards.accountDetailTitle')
            : itemType === 'card'
            ? t('cards.detailTitle')
            : itemType === 'code'
            ? t('codes.detailTitle')
            : domain;
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t('viewCredential.showCredentials', {
            domain: promptTarget,
          }),
          fallbackLabel: 'PIN verwenden',
          disableDeviceFallback: false,
        });

        if (!result.success) {
          setAuthError(t('viewCredential.authFailed'));
          setLoading(false);
          return;
        }
      }

      if (itemType === 'bankAccount') {
        const acc = await getBankAccountById(bankAccountId || activeId);
        if (!acc) {
          setAuthError(t('viewCredential.noCredFound'));
          setLoading(false);
          return;
        }
        setActiveId(acc.id);
        setSelectedBankAccountId(acc.id);
        setBankAccountName(acc.name || '');
        setCardIssuer(acc.bankName || '');
        setCardholderName(acc.holderName || '');
        setIban(acc.iban || '');
        setBic(acc.bic || '');
        setCardColor(acc.color || 'gold');
        const det = acc.iban ? lookupBankByIban(acc.iban) : null;
        setAutoDetectedInfo(det?.detected ? det : null);
        const loadedNote = await getNote(acc.id);
        setNotes(loadedNote || '');
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      if (itemType === 'card') {
        const [card, allAccs] = await Promise.all([
          getCardById(cardId || activeId),
          getBankAccounts(),
        ]);
        setBankAccounts(allAccs);
        if (!card) {
          setAuthError(t('viewCredential.noCredFound'));
          setLoading(false);
          return;
        }
        setActiveId(card.id);
        setSelectedBankAccountId(card.accountId || null);
        setBankAccountName(card.accountName || '');
        setCardLabel(card.label || '');
        setCardIssuer(card.issuer || '');
        setCardholderName(card.cardholderName || '');
        setCardNumber(card.number || '');
        setExpiryMonth(card.expiryMonth || '');
        setExpiryYear(card.expiryYear || '');
        setCvv(card.cvv || '');
        setPin(card.pin || '');
        setIban(card.iban || '');
        setBic(card.bic || '');
        setCardColor(card.color || 'gold');
        const det = card.iban ? lookupBankByIban(card.iban) : null;
        setAutoDetectedInfo(det?.detected ? det : null);
        const loadedNote = await getNote(card.id);
        setNotes(loadedNote || '');
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      if (itemType === 'code') {
        const codeObj = await getCodeById(codeId || activeId);
        if (!codeObj) {
          setAuthError(t('viewCredential.noCredFound'));
          setLoading(false);
          return;
        }
        setActiveId(codeObj.id);
        setCodeLabel(codeObj.label || '');
        setCodeValue(codeObj.code || '');
        setCodeCategory(codeObj.codeCategory || 'door');
        setCodeLocation(codeObj.location || '');
        const loadedNote = await getNote(codeObj.id);
        setNotes(loadedNote || '');
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      const accounts = await getCredentialsForDomain(domain);
      const creds = activeId
        ? accounts.find((a) => a.id === activeId)
        : accounts[0] || null;

      if (creds) {
        setActiveId(creds.id);
        setAccountName(creds.name || '');
        setSelectedCategory(creds.category || null);
        const loadedNote = await getNote(creds.id);
        setNotes(loadedNote || '');
        await refreshLinkedTotp(creds.id);
        if (creds.hidden) {
          setIsHidden(true);
          setUsername(creds.username || '');
          setPassword('');
        } else {
          setIsHidden(false);
          setUsername(creds.username || '');
          setPassword(creds.password || '');
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

  const applySelectedBankAccount = (acc) => {
    if (!acc) {
      setSelectedBankAccountId(null);
      setBankAccountName('');
      setIban('');
      setBic('');
      setAutoDetectedInfo(null);
      setUserEditedBank(false);
      setUserEditedBic(false);
      return;
    }
    setSelectedBankAccountId(acc.id);
    setBankAccountName(acc.name || '');
    setIban(acc.iban || '');
    setBic(acc.bic || '');
    if (acc.bankName) setCardIssuer(acc.bankName);
    if (acc.holderName && !cardholderName.trim()) {
      setCardholderName(acc.holderName);
    }
    const det = acc.iban ? lookupBankByIban(acc.iban) : null;
    setAutoDetectedInfo(det?.detected ? det : null);
  };

  const handleIbanChange = (rawText) => {
    const clean = normalizeIban(rawText);
    setIban(clean);
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

  const handleSave = async () => {
    if (itemType === 'bankAccount') {
      const cleanIbanVal = normalizeIban(iban);
      if (!bankAccountName.trim() && cleanIbanVal.length < 8) {
        toast.warn(t('error'), t('cards.missingAccountRequired'));
        return;
      }
      setSaving(true);
      try {
        await saveBankAccount({
          id: activeId,
          name:
            bankAccountName.trim() ||
            cardIssuer.trim() ||
            t('cards.defaultAccountName'),
          iban: cleanIbanVal,
          bic: bic.trim().toUpperCase(),
          bankName: cardIssuer.trim(),
          holderName: cardholderName.trim(),
          color: cardColor,
          notes: notes.slice(0, 1000),
        });
        toast.success(t('cards.accountSavedToast'));
        navigation.goBack();
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

    if (itemType === 'card') {
      const cleanNumber = cardNumber.replace(/\D/g, '');
      if (!cardLabel.trim() || cleanNumber.length < 8) {
        toast.warn(t('error'), t('cards.missingRequired'));
        return;
      }
      setSaving(true);
      try {
        await saveCard({
          id: activeId,
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
          notes: notes.slice(0, 1000),
        });
        toast.success(t('cards.savedToast'));
        navigation.goBack();
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

    if (itemType === 'code') {
      if (!codeLabel.trim() || !codeValue.trim()) {
        toast.warn(t('error'), t('codes.missingRequired'));
        return;
      }
      setSaving(true);
      try {
        await saveCode({
          id: activeId,
          label: codeLabel.trim(),
          code: codeValue.trim(),
          codeCategory,
          location: codeLocation.trim(),
          notes: notes.slice(0, 1000),
        });
        toast.success(t('codes.savedToast'));
        navigation.goBack();
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

    if (!isHidden && (!username.trim() || !password.trim())) {
      toast.warn(t('error'), t('viewCredential.allFieldsRequired'));
      return;
    }

    setSaving(true);
    try {
      await saveCredentials(domain, username.trim(), password, {
        id: activeId,
        name: accountName.trim(),
        category: selectedCategory,
        hidden: isHidden,
        ...(isHidden ? {} : { notes: notes.slice(0, 1000) }),
      });
      toast.success(
        t('viewCredential.savedTitle'),
        t('viewCredential.savedMsg', { domain })
      );
      navigation.goBack();
    } catch (err) {
      toast.error(
        t('error'),
        t('viewCredential.saveFailed', { message: err.message })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCurrentItem = () => {
    if (itemType === 'bankAccount') {
      toast.confirm({
        title: t('cards.deleteAccountConfirmTitle'),
        message: t('cards.deleteAccountConfirmMsg', {
          name: bankAccountName || cardIssuer || 'Konto',
        }),
        confirmText: t('delete'),
        cancelText: t('cancel'),
        danger: true,
        onConfirm: async () => {
          await deleteBankAccount(activeId, { deleteCards: true });
          toast.success(t('cards.accountDeletedToast'));
          navigation.goBack();
        },
      });
      return;
    }

    if (itemType === 'card') {
      toast.confirm({
        title: t('cards.deleteConfirmTitle'),
        message: t('cards.deleteConfirmMsg', { label: cardLabel || 'Card' }),
        confirmText: t('delete'),
        cancelText: t('cancel'),
        danger: true,
        onConfirm: async () => {
          await deleteCard(activeId);
          toast.success(t('cards.deletedToast'));
          navigation.goBack();
        },
      });
      return;
    }

    if (itemType === 'code') {
      toast.confirm({
        title: t('codes.deleteConfirmTitle'),
        message: t('codes.deleteConfirmMsg', { label: codeLabel || 'Code' }),
        confirmText: t('delete'),
        cancelText: t('cancel'),
        danger: true,
        onConfirm: async () => {
          await deleteCode(activeId);
          toast.success(t('codes.deletedToast'));
          navigation.goBack();
        },
      });
    }
  };

  const copyToClipboard = async (text, label) => {
    if (!text) return;
    await Clipboard.setStringAsync(String(text));
    toast.success(t('toast.copiedAutoClear', { label }));

    // Auto-clear clipboard after 45 seconds to protect sensitive credentials (Art. 32 DSGVO)
    setTimeout(async () => {
      try {
        const current = await Clipboard.getStringAsync();
        if (current === String(text)) {
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
              <Text style={[styles.backText, { color: colors.gold }]}>
                {t('common.back')}
              </Text>
            </View>
          </TapFeedback>
        </View>
        <View style={styles.centerContent}>
          <AppIcon name="lock" size={48} color={colors.gold} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            {t('viewCredential.accessDenied')}
          </Text>
          <Text style={[styles.errorText, { color: colors.danger }]}>
            {authError}
          </Text>
          <TapFeedback
            style={[
              styles.retryBtn,
              {
                backgroundColor: colors.goldBg,
                borderColor: colors.goldBorder,
              },
            ]}
            onPress={authenticateAndLoad}
          >
            <Text style={[styles.retryBtnText, { color: colors.gold }]}>
              {t('retry')}
            </Text>
          </TapFeedback>
        </View>
      </SafeAreaView>
    );
  }

  const detectedBrand = detectCardBrand(cardNumber);
  const brandDisplay = getCardBrandDisplayName(detectedBrand);
  const cleanCardDigits = cardNumber.replace(/\D/g, '');
  const isLuhnChecked = cleanCardDigits.length >= 12;
  const isLuhnValid = isLuhnChecked ? validateLuhn(cleanCardDigits) : false;
  const ibanValidation = validateIban(iban);
  const activeCardTheme =
    CARD_COLOR_THEMES[cardColor] || CARD_COLOR_THEMES.gold;
  const expStatus = getCardExpiryStatus(expiryMonth, expiryYear);
  const activeCodeMeta =
    CODE_CATEGORIES.find((c) => c.id === codeCategory) || CODE_CATEGORIES[0];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <View style={styles.topActionRow}>
              <TapFeedback
                onPress={() => navigation.goBack()}
                style={styles.backBtn}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <AppIcon name="back" size={16} color={colors.gold} />
                  <Text style={[styles.backText, { color: colors.gold }]}>
                    {t('common.back')}
                  </Text>
                </View>
              </TapFeedback>

              {(itemType === 'bankAccount' ||
                itemType === 'card' ||
                itemType === 'code') && (
                <TouchableOpacity
                  style={[
                    styles.headerDeleteBtn,
                    {
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      borderColor: 'rgba(239, 68, 68, 0.35)',
                    },
                  ]}
                  onPress={handleDeleteCurrentItem}
                >
                  <AppIcon name="trash" size={15} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>

            {itemType === 'login' ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginTop: 4,
                  }}
                >
                  <FaviconImage domain={domain} size={36} borderRadius={8} />
                  <Text style={[styles.title, { color: colors.text }]}>
                    {domain}
                  </Text>
                </View>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  {t('viewCredential.viewAndEdit')}
                </Text>
              </>
            ) : itemType === 'bankAccount' ? (
              <>
                <Text style={[styles.title, { color: colors.text }]}>
                  {bankAccountName || t('cards.accountDetailTitle')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  {t('cards.editAccountTitle')}
                </Text>
              </>
            ) : itemType === 'card' ? (
              <>
                <Text style={[styles.title, { color: colors.text }]}>
                  {cardLabel || t('cards.detailTitle')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  {t('cards.editCardTitle')}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.title, { color: colors.text }]}>
                  {codeLabel || t('codes.detailTitle')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  {t('codes.editCodeTitle')}
                </Text>
              </>
            )}
          </View>

          {itemType === 'bankAccount' && (
            <View style={styles.form}>
              <LinearGradient
                colors={activeCardTheme.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.bankCardVisual,
                  { borderColor: activeCardTheme.border },
                ]}
              >
                <View style={styles.bankCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bankCardLabelText} numberOfLines={1}>
                      {bankAccountName || t('cards.defaultAccountName')}
                    </Text>
                    <Text style={styles.bankCardIssuerText} numberOfLines={1}>
                      {[cardIssuer, bic].filter(Boolean).join(' • ') ||
                        t('cards.accountDetailTitle')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.brandBadge,
                      { borderColor: activeCardTheme.accent + '66' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.brandBadgeText,
                        { color: activeCardTheme.accent },
                      ]}
                    >
                      IBAN
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.bankCardNumRow}
                  onPress={() =>
                    copyToClipboard(
                      formatIban(iban, false),
                      t('cards.copyIban')
                    )
                  }
                  activeOpacity={0.8}
                >
                  <CategoryIcon
                    name="briefcase"
                    size={22}
                    color={activeCardTheme.accent}
                  />
                  <Text
                    style={[
                      styles.bankCardFullNum,
                      { fontSize: 15, letterSpacing: 1.2 },
                    ]}
                  >
                    {iban ? formatIban(iban, false) : '—'}
                  </Text>
                  <AppIcon
                    name="copy"
                    size={15}
                    color="rgba(255,255,255,0.75)"
                  />
                </TouchableOpacity>

                <View style={styles.bankCardBottom}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bankCardMetaCap}>
                      {t('cards.cardholderName')}
                    </Text>
                    <Text style={styles.bankCardMetaVal} numberOfLines={1}>
                      {cardholderName || '—'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.bankCardMetaCap}>{t('cards.bic')}</Text>
                    <Text style={styles.bankCardMetaVal}>{bic || '—'}</Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.quickCopyGrid}>
                {!!iban && (
                  <TouchableOpacity
                    style={[
                      styles.quickCopyBtn,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() =>
                      copyToClipboard(
                        formatIban(iban, false),
                        t('cards.copyIban')
                      )
                    }
                  >
                    <AppIcon name="copy" size={14} color={colors.gold} />
                    <Text
                      style={[styles.quickCopyBtnText, { color: colors.text }]}
                    >
                      {t('cards.copyIban')}
                    </Text>
                  </TouchableOpacity>
                )}

                {!!bic && (
                  <TouchableOpacity
                    style={[
                      styles.quickCopyBtn,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => copyToClipboard(bic, t('cards.copyBic'))}
                  >
                    <AppIcon name="copy" size={14} color={colors.gold} />
                    <Text
                      style={[styles.quickCopyBtnText, { color: colors.text }]}
                    >
                      {t('cards.copyBic')}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.quickCopyBtn,
                    {
                      backgroundColor: colors.goldBg,
                      borderColor: colors.goldBorder,
                    },
                  ]}
                  onPress={() =>
                    navigation.navigate('Credentials', {
                      initialType: 'card',
                      prefillBankAccountId: activeId,
                    })
                  }
                >
                  <AppIcon name="plus" size={14} color={colors.gold} />
                  <Text
                    style={[styles.quickCopyBtnText, { color: colors.gold }]}
                  >
                    {t('cards.addCardToAccountBtn')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('cards.accountNameLabel')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={bankAccountName}
                  onChangeText={setBankAccountName}
                  placeholder={t('cards.accountNamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.notesHeaderRow}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('cards.iban')}
                  </Text>
                  {ibanValidation.isChecked && (
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: ibanValidation.isValid ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {ibanValidation.isValid
                        ? t('cards.ibanValid')
                        : t('cards.ibanInvalid')}
                    </Text>
                  )}
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
                      color: colors.text,
                      letterSpacing: 1,
                      fontWeight: '700',
                    },
                  ]}
                  value={formatIban(iban, false)}
                  onChangeText={handleIbanChange}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={t('cards.ibanPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.fieldGroup, { flex: 1.3 }]}>
                  <View style={styles.notesHeaderRow}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
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
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={cardIssuer}
                    onChangeText={(v) => {
                      setUserEditedBank(true);
                      setCardIssuer(v);
                    }}
                    placeholder={t('cards.issuerPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <View style={styles.notesHeaderRow}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
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
                        borderColor: colors.border,
                        color: colors.text,
                        fontWeight: '700',
                      },
                    ]}
                    value={bic}
                    onChangeText={(v) => {
                      setUserEditedBic(true);
                      setBic(v.replace(/\s+/g, '').toUpperCase().slice(0, 11));
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder={t('cards.bicPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('cards.cardholderName')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={cardholderName}
                  onChangeText={setCardholderName}
                  autoCapitalize="characters"
                  placeholder={t('cards.cardholderPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.notesHeaderRow}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('viewCredential.notesLabel')}
                  </Text>
                  <Text
                    style={[styles.charCounter, { color: colors.textMuted }]}
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
                      color: colors.text,
                    },
                  ]}
                  value={notes}
                  onChangeText={(val) => setNotes(val.slice(0, 1000))}
                  placeholder={t('viewCredential.notesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
              </View>
            </View>
          )}

          {itemType === 'card' && (
            <View style={styles.form}>
              {/* Full Unmasked Stylized Card */}
              <LinearGradient
                colors={activeCardTheme.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.bankCardVisual,
                  { borderColor: activeCardTheme.border },
                ]}
              >
                <View style={styles.bankCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bankCardLabelText} numberOfLines={1}>
                      {cardLabel || brandDisplay}
                    </Text>
                    <Text style={styles.bankCardIssuerText} numberOfLines={1}>
                      {[bankAccountName, cardIssuer, bic]
                        .filter(Boolean)
                        .join(' • ') || brandDisplay}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.brandBadge,
                      { borderColor: activeCardTheme.accent + '66' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.brandBadgeText,
                        { color: activeCardTheme.accent },
                      ]}
                    >
                      {brandDisplay}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.bankCardNumRow}
                  onPress={() =>
                    copyToClipboard(cardNumber, t('cards.copyNumber'))
                  }
                  activeOpacity={0.8}
                >
                  <AppIcon
                    name="chip"
                    size={26}
                    color={activeCardTheme.accent}
                  />
                  <Text style={styles.bankCardFullNum}>
                    {formatCardNumber(cardNumber, false)}
                  </Text>
                  <AppIcon
                    name="copy"
                    size={15}
                    color="rgba(255,255,255,0.75)"
                  />
                </TouchableOpacity>

                {!!iban && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 12,
                    }}
                    onPress={() =>
                      copyToClipboard(
                        formatIban(iban, false),
                        t('cards.copyIban')
                      )
                    }
                  >
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.78)',
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 0.8,
                      }}
                    >
                      IBAN: {formatIban(iban, false)}
                    </Text>
                    <AppIcon
                      name="copy"
                      size={12}
                      color="rgba(255,255,255,0.65)"
                    />
                  </TouchableOpacity>
                )}

                <View style={styles.bankCardBottom}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bankCardMetaCap}>
                      {t('cards.cardholderName')}
                    </Text>
                    <Text style={styles.bankCardMetaVal} numberOfLines={1}>
                      {cardholderName || '—'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center', marginHorizontal: 12 }}>
                    <Text style={styles.bankCardMetaCap}>
                      {t('cards.validThru')}
                    </Text>
                    <Text style={styles.bankCardMetaVal}>
                      {expStatus.formatted || '—/—'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.bankCardMetaCap}>{t('cards.cvv')}</Text>
                    <Text style={styles.bankCardMetaVal}>
                      {showCvv ? cvv || '—' : '•••'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              {/* 1-Tap Copy Bar with 45s Auto-Clear */}
              <View style={styles.quickCopyGrid}>
                <TouchableOpacity
                  style={[
                    styles.quickCopyBtn,
                    {
                      backgroundColor: colors.cardBg,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() =>
                    copyToClipboard(cardNumber, t('cards.copyNumber'))
                  }
                >
                  <AppIcon name="copy" size={14} color={colors.gold} />
                  <Text
                    style={[styles.quickCopyBtnText, { color: colors.text }]}
                  >
                    {t('cards.copyNumber')}
                  </Text>
                </TouchableOpacity>

                {!!expStatus.formatted && (
                  <TouchableOpacity
                    style={[
                      styles.quickCopyBtn,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() =>
                      copyToClipboard(
                        expStatus.formatted,
                        t('cards.copyExpiry')
                      )
                    }
                  >
                    <AppIcon name="copy" size={14} color={colors.gold} />
                    <Text
                      style={[styles.quickCopyBtnText, { color: colors.text }]}
                    >
                      {t('cards.copyExpiry')}
                    </Text>
                  </TouchableOpacity>
                )}

                {!!cvv && (
                  <TouchableOpacity
                    style={[
                      styles.quickCopyBtn,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => copyToClipboard(cvv, t('cards.copyCvv'))}
                  >
                    <AppIcon name="copy" size={14} color={colors.gold} />
                    <Text
                      style={[styles.quickCopyBtnText, { color: colors.text }]}
                    >
                      {t('cards.copyCvv')}
                    </Text>
                  </TouchableOpacity>
                )}

                {!!pin && (
                  <TouchableOpacity
                    style={[
                      styles.quickCopyBtn,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => copyToClipboard(pin, t('cards.copyPin'))}
                  >
                    <AppIcon name="copy" size={14} color={colors.gold} />
                    <Text
                      style={[styles.quickCopyBtnText, { color: colors.text }]}
                    >
                      {t('cards.copyPin')}
                    </Text>
                  </TouchableOpacity>
                )}

                {!!iban && (
                  <TouchableOpacity
                    style={[
                      styles.quickCopyBtn,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() =>
                      copyToClipboard(
                        formatIban(iban, false),
                        t('cards.copyIban')
                      )
                    }
                  >
                    <AppIcon name="copy" size={14} color={colors.gold} />
                    <Text
                      style={[styles.quickCopyBtnText, { color: colors.text }]}
                    >
                      {t('cards.copyIban')}
                    </Text>
                  </TouchableOpacity>
                )}

                {!!bic && (
                  <TouchableOpacity
                    style={[
                      styles.quickCopyBtn,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => copyToClipboard(bic, t('cards.copyBic'))}
                  >
                    <AppIcon name="copy" size={14} color={colors.gold} />
                    <Text
                      style={[styles.quickCopyBtnText, { color: colors.text }]}
                    >
                      {t('cards.copyBic')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Linked Bank Account & Auto-BIC/Bank Section */}
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.goldBorder,
                  backgroundColor: colors.cardBg,
                  borderRadius: 12,
                  padding: 14,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
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
                      style={{
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: '800',
                      }}
                    >
                      {t('cards.accountSectionTitle')}
                    </Text>
                  </View>
                  {autoDetectedInfo?.detected && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        borderWidth: 1,
                        borderRadius: 6,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        backgroundColor: 'rgba(16, 185, 129, 0.14)',
                        borderColor: 'rgba(16, 185, 129, 0.45)',
                      }}
                    >
                      <AppIcon name="check-circle" size={11} color="#10b981" />
                      <Text
                        style={{
                          color: '#10b981',
                          fontSize: 10,
                          fontWeight: '800',
                        }}
                      >
                        {t('cards.autoDetectedBadge')}
                      </Text>
                    </View>
                  )}
                </View>

                {bankAccounts.length > 0 && (
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
                            : colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          {
                            color: !selectedBankAccountId
                              ? colors.gold
                              : colors.textSecondary,
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
                            color={isSel ? colors.gold : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.categoryChipText,
                              {
                                color: isSel ? colors.gold : colors.text,
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
                )}

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('cards.accountNameLabel')}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={bankAccountName}
                    onChangeText={setBankAccountName}
                    placeholder={t('cards.accountNamePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <View style={styles.notesHeaderRow}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      {t('cards.iban')}
                    </Text>
                    {ibanValidation.isChecked && (
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: ibanValidation.isValid ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {ibanValidation.isValid
                          ? t('cards.ibanValid')
                          : t('cards.ibanInvalid')}
                      </Text>
                    )}
                  </View>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.inputFlex,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: ibanValidation.isChecked
                            ? ibanValidation.isValid
                              ? '#10b981'
                              : '#f59e0b'
                            : colors.border,
                          color: colors.text,
                          letterSpacing: 1,
                          fontWeight: '700',
                        },
                      ]}
                      value={formatIban(iban, false)}
                      onChangeText={handleIbanChange}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder={t('cards.ibanPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                    />
                    {!!iban && (
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          {
                            backgroundColor: colors.cardBg,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() =>
                          copyToClipboard(
                            formatIban(iban, false),
                            t('cards.copyIban')
                          )
                        }
                      >
                        <AppIcon
                          name="copy"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.fieldGroup, { flex: 1.3 }]}>
                    <View style={styles.notesHeaderRow}>
                      <Text
                        style={[styles.label, { color: colors.textSecondary }]}
                      >
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
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      value={cardIssuer}
                      onChangeText={(v) => {
                        setUserEditedBank(true);
                        setCardIssuer(v);
                      }}
                      placeholder={t('cards.issuerPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <View style={styles.notesHeaderRow}>
                      <Text
                        style={[styles.label, { color: colors.textSecondary }]}
                      >
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
                          borderColor: colors.border,
                          color: colors.text,
                          fontWeight: '700',
                        },
                      ]}
                      value={bic}
                      onChangeText={(v) => {
                        setUserEditedBic(true);
                        setBic(v.replace(/\s+/g, '').toUpperCase().slice(0, 11));
                      }}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder={t('cards.bicPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('cards.labelField')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={cardLabel}
                  onChangeText={setCardLabel}
                  placeholder={t('cards.labelPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('cards.cardholderName')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={cardholderName}
                  onChangeText={setCardholderName}
                  autoCapitalize="characters"
                  placeholder={t('cards.cardholderPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('cards.cardNumber')}
                </Text>
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
                      color: colors.text,
                      letterSpacing: 1.5,
                      fontWeight: '700',
                    },
                  ]}
                  value={formatCardNumber(cardNumber, false)}
                  onChangeText={(txt) =>
                    setCardNumber(txt.replace(/\D/g, '').slice(0, 19))
                  }
                  keyboardType="number-pad"
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('cards.expiryMonth')}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                        color: colors.text,
                        textAlign: 'center',
                      },
                    ]}
                    value={expiryMonth}
                    onChangeText={(v) =>
                      setExpiryMonth(v.replace(/\D/g, '').slice(0, 2))
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('cards.expiryYear')}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                        color: colors.text,
                        textAlign: 'center',
                      },
                    ]}
                    value={expiryYear}
                    onChangeText={(v) =>
                      setExpiryYear(v.replace(/\D/g, '').slice(0, 2))
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1.3 }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('cards.cvv')}
                  </Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.passwordInput,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.border,
                          color: colors.text,
                          textAlign: 'center',
                        },
                      ]}
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
                        styles.actionBtn,
                        {
                          backgroundColor: colors.cardBg,
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
                <Text style={[styles.label, { color: colors.textSecondary }]}>
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
                        color: colors.text,
                      },
                    ]}
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
                      styles.actionBtn,
                      {
                        backgroundColor: colors.cardBg,
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
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
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
                <View style={styles.notesHeaderRow}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('viewCredential.notesLabel')}
                  </Text>
                  <Text
                    style={[styles.charCounter, { color: colors.textMuted }]}
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
                      color: colors.text,
                    },
                  ]}
                  value={notes}
                  onChangeText={(val) => setNotes(val.slice(0, 1000))}
                  placeholder={t('viewCredential.notesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
              </View>

              <View
                style={[
                  styles.noShareBanner,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <AppIcon name="shield" size={16} color={colors.gold} />
                <Text
                  style={[
                    styles.noShareBannerText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t('cards.noShareNotice')}
                </Text>
              </View>
            </View>
          )}

          {itemType === 'code' && (
            <View style={styles.form}>
              {/* Large High-Contrast Digit/Character Display */}
              <View
                style={[
                  styles.codeHeroCard,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.goldBorder,
                  },
                ]}
              >
                <View style={styles.codeHeroHeader}>
                  <CategoryIcon
                    name={activeCodeMeta.icon}
                    size={22}
                    color={colors.gold}
                  />
                  <Text
                    style={[styles.codeHeroCatText, { color: colors.gold }]}
                  >
                    {t(activeCodeMeta.labelKey)}
                  </Text>
                </View>

                <View style={styles.digitTilesWrap}>
                  {String(codeValue || '')
                    .split('')
                    .map((ch, idx) => (
                      <View
                        key={`${idx}_${ch}`}
                        style={[
                          styles.digitTile,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.goldBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.digitTileText, { color: colors.gold }]}
                        >
                          {ch}
                        </Text>
                      </View>
                    ))}
                </View>

                <View style={styles.codeHeroBtnRow}>
                  <TouchableOpacity
                    style={[
                      styles.codeHeroActionBtn,
                      {
                        backgroundColor: colors.goldBg,
                        borderColor: colors.goldBorder,
                      },
                    ]}
                    onPress={() =>
                      copyToClipboard(
                        codeValue,
                        codeLabel || t('codes.copyCode')
                      )
                    }
                  >
                    <AppIcon name="copy" size={16} color={colors.gold} />
                    <Text
                      style={[
                        styles.codeHeroActionText,
                        { color: colors.gold },
                      ]}
                    >
                      {t('codes.copyCode')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.codeHeroActionBtn,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() =>
                      navigation.navigate('ShareImport', {
                        mode: 'share',
                        preselectCodeId: activeId,
                      })
                    }
                  >
                    <AppIcon name="qr" size={16} color={colors.text} />
                    <Text
                      style={[
                        styles.codeHeroActionText,
                        { color: colors.text },
                      ]}
                    >
                      {t('codes.shareQrBtn')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('codes.categoryField')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  {CODE_CATEGORIES.map((cc) => {
                    const selected = codeCategory === cc.id;
                    return (
                      <TouchableOpacity
                        key={cc.id}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: colors.cardBg,
                            borderColor: colors.border,
                          },
                          selected && {
                            backgroundColor: colors.goldBg,
                            borderColor: colors.gold,
                          },
                        ]}
                        onPress={() => setCodeCategory(cc.id)}
                      >
                        <CategoryIcon
                          name={cc.icon}
                          size={15}
                          color={selected ? colors.gold : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.categoryChipText,
                            {
                              color: selected
                                ? colors.gold
                                : colors.textSecondary,
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

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('codes.labelField')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={codeLabel}
                  onChangeText={setCodeLabel}
                  placeholder={t('codes.labelPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
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
                  value={codeValue}
                  onChangeText={setCodeValue}
                  placeholder={t('codes.codePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('codes.locationField')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={codeLocation}
                  onChangeText={setCodeLocation}
                  placeholder={t('codes.locationPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.notesHeaderRow}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('viewCredential.notesLabel')}
                  </Text>
                  <Text
                    style={[styles.charCounter, { color: colors.textMuted }]}
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
                      color: colors.text,
                    },
                  ]}
                  value={notes}
                  onChangeText={(val) => setNotes(val.slice(0, 1000))}
                  placeholder={t('viewCredential.notesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
              </View>
            </View>
          )}

          {itemType === 'login' && (
            <View style={styles.form}>
              {isHidden ? (
                <>
                  <View
                    style={[
                      styles.hiddenCard,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <AppIcon name="lock" size={40} color={colors.gold} />
                    <Text style={[styles.hiddenTitle, { color: colors.text }]}>
                      {t('viewCredential.restrictedTitle')}
                    </Text>
                    <Text
                      style={[
                        styles.hiddenText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t('viewCredential.restrictedDesc')}
                    </Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      {t('viewCredential.accountNameLabel')}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder={t('viewCredential.accountNamePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={accountName}
                      onChangeText={setAccountName}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>

                  {notes ? (
                    <View style={styles.fieldGroup}>
                      <Text
                        style={[styles.label, { color: colors.textSecondary }]}
                      >
                        {t('viewCredential.notesLabel')}
                      </Text>
                      <View style={styles.notesRow}>
                        <View
                          style={[
                            styles.input,
                            styles.notesReadonlyBox,
                            {
                              backgroundColor: colors.inputBg,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.notesReadonlyText,
                              { color: colors.text },
                            ]}
                            selectable
                          >
                            {notes}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            {
                              backgroundColor: colors.cardBg,
                              borderColor: colors.border,
                            },
                          ]}
                          onPress={() =>
                            copyToClipboard(
                              notes,
                              t('viewCredential.notesLabel')
                            )
                          }
                        >
                          <AppIcon
                            name="copy"
                            size={18}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={styles.fieldGroup}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      {t('viewCredential.accountNameLabel')}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder={t('viewCredential.accountNamePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={accountName}
                      onChangeText={setAccountName}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      {t('viewCredential.usernameLabel')}
                    </Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={[
                          styles.input,
                          styles.inputFlex,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        placeholder="dein@email.com"
                        placeholderTextColor={colors.textMuted}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                      />
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          {
                            backgroundColor: colors.cardBg,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() =>
                          copyToClipboard(
                            username,
                            t('viewCredential.usernameLabel')
                          )
                        }
                      >
                        <AppIcon
                          name="copy"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      {t('viewCredential.passwordLabel')}
                    </Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[
                          styles.input,
                          styles.passwordInput,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        placeholder="••••••••••"
                        placeholderTextColor={colors.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          {
                            backgroundColor: colors.cardBg,
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
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          {
                            backgroundColor: colors.cardBg,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() =>
                          copyToClipboard(
                            password,
                            t('viewCredential.passwordLabel')
                          )
                        }
                      >
                        <AppIcon
                          name="copy"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <View style={styles.notesHeaderRow}>
                      <Text
                        style={[styles.label, { color: colors.textSecondary }]}
                      >
                        {t('viewCredential.notesLabel')}
                      </Text>
                      <Text
                        style={[
                          styles.charCounter,
                          {
                            color:
                              notes.length >= 1000
                                ? colors.warning
                                : colors.textMuted,
                          },
                        ]}
                      >
                        {notes.length}/1000
                      </Text>
                    </View>
                    <View style={styles.notesRow}>
                      <TextInput
                        style={[
                          styles.input,
                          styles.notesInput,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        placeholder={t('viewCredential.notesPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={notes}
                        onChangeText={(val) => setNotes(val.slice(0, 1000))}
                        multiline
                        maxLength={1000}
                        textAlignVertical="top"
                      />
                      {notes ? (
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            {
                              backgroundColor: colors.cardBg,
                              borderColor: colors.border,
                              alignSelf: 'flex-start',
                            },
                          ]}
                          onPress={() =>
                            copyToClipboard(
                              notes,
                              t('viewCredential.notesLabel')
                            )
                          }
                        >
                          <AppIcon
                            name="copy"
                            size={18}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </>
              )}

              {/* Linked 2FA Section */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('viewCredential.linked2faTitle')}
                </Text>
                {linkedTotp ? (
                  (() => {
                    const period = linkedTotp.period || 30;
                    const digits = linkedTotp.digits || 6;
                    const algorithm = linkedTotp.algorithm || 'SHA1';
                    const rawCode = generateTOTP(
                      linkedTotp.secret,
                      period,
                      digits,
                      algorithm
                    );
                    const formattedCode =
                      rawCode.length === 8
                        ? `${rawCode.slice(0, 4)} ${rawCode.slice(4)}`
                        : `${rawCode.slice(0, 3)} ${rawCode.slice(3)}`;
                    const remaining = getRemainingSeconds(period);
                    return (
                      <View
                        style={[
                          styles.totpCard,
                          {
                            backgroundColor: colors.cardBg,
                            borderColor: colors.goldBorder,
                          },
                        ]}
                      >
                        <View style={styles.totpCardLeft}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <AppIcon name="key" size={14} color={colors.gold} />
                            <Text
                              style={[
                                styles.totpIssuer,
                                { color: colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {linkedTotp.issuer || domain}
                            </Text>
                          </View>
                          <Text
                            style={[styles.totpCode, { color: colors.gold }]}
                          >
                            {formattedCode}
                          </Text>
                        </View>
                        <View style={styles.totpCardRight}>
                          <View
                            style={[
                              styles.totpTimerBadge,
                              {
                                backgroundColor:
                                  remaining <= 5
                                    ? colors.dangerBg
                                    : colors.goldBg,
                                borderColor:
                                  remaining <= 5
                                    ? colors.dangerBorder
                                    : colors.goldBorder,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.totpTimerText,
                                {
                                  color:
                                    remaining <= 5
                                      ? colors.danger
                                      : colors.gold,
                                },
                              ]}
                            >
                              {remaining}s
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              {
                                backgroundColor: colors.inputBg,
                                borderColor: colors.border,
                              },
                            ]}
                            onPress={() =>
                              copyToClipboard(
                                rawCode,
                                t('viewCredential.linked2faTitle')
                              )
                            }
                          >
                            <AppIcon
                              name="copy"
                              size={18}
                              color={colors.textSecondary}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })()
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.add2faBtn,
                      {
                        backgroundColor: colors.goldBg,
                        borderColor: colors.goldBorder,
                      },
                    ]}
                    onPress={() =>
                      navigation.navigate('Authenticator', {
                        prefillAdd: {
                          credId: activeId,
                          domain,
                          issuer: domain,
                          accountName: username || accountName,
                        },
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <AppIcon name="key" size={16} color={colors.gold} />
                    <Text style={[styles.add2faBtnText, { color: colors.gold }]}>
                      {t('viewCredential.add2faBtn')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
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
                      size={13}
                      color={!selectedCategory ? colors.gold : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: colors.textSecondary },
                        !selectedCategory && {
                          color: colors.text,
                          fontWeight: '700',
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
                          color={
                            isSelected ? colors.gold : colors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.categoryChipText,
                            { color: colors.textSecondary },
                            isSelected && {
                              color: colors.text,
                              fontWeight: '700',
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
                    <AppIcon name="plus" size={13} color={colors.gold} />
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
                {saving
                  ? t('viewCredential.saving')
                  : t('viewCredential.saveChanges')}
              </Text>
            </LinearGradient>
          </TapFeedback>
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
              {
                backgroundColor:
                  colors.cardBgModal ||
                  (colors.bg === '#07090e' ? '#0d111a' : '#ffffff'),
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('categories.newCategory')}
            </Text>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              {t('categories.categoryName')}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder={t('categories.categoryNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoCapitalize="words"
            />

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              {t('categories.selectIcon')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.iconPickerScroll}
            >
              <View style={styles.iconPickerRow}>
                {AVAILABLE_CATEGORY_ICONS.map((catKey) => {
                  const isSelected = newCategoryIcon === catKey;
                  return (
                    <TouchableOpacity
                      key={catKey}
                      style={[
                        styles.iconOption,
                        {
                          backgroundColor: colors.cardBg,
                          borderColor: colors.border,
                        },
                        isSelected && {
                          backgroundColor: colors.goldBg,
                          borderColor: colors.gold,
                        },
                      ]}
                      onPress={() => setNewCategoryIcon(catKey)}
                    >
                      <CategoryIcon
                        name={catKey}
                        size={18}
                        color={isSelected ? colors.gold : colors.textSecondary}
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
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setShowCategoryModal(false)}
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
              >
                <LinearGradient
                  colors={colors.goldGradient}
                  style={styles.modalSaveGradient}
                >
                  <Text style={[styles.modalSaveText, { color: '#ffffff' }]}>
                    {t('save')}
                  </Text>
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
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  stateTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  retryBtnText: { fontWeight: '700', fontSize: 14 },
  header: { marginBottom: 20 },
  topActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '600' },
  headerDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4 },
  form: { gap: 18, marginBottom: 28 },
  fieldGroup: { gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.08,
  },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  inputFlex: { flex: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  passwordRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  passwordInput: { flex: 1 },
  notesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCounter: { fontSize: 11, fontWeight: '600' },
  notesRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  notesInput: { flex: 1, minHeight: 88, paddingTop: 12 },
  notesReadonlyBox: { flex: 1, minHeight: 60 },
  notesReadonlyText: { fontSize: 14, lineHeight: 20 },
  // Bank Card Visual
  bankCardVisual: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  bankCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  bankCardLabelText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  bankCardIssuerText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    marginTop: 2,
  },
  brandBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  bankCardNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  bankCardFullNum: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    flex: 1,
  },
  bankCardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bankCardMetaCap: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  bankCardMetaVal: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  quickCopyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quickCopyBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
  noShareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  noShareBannerText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  // Code Hero Card
  codeHeroCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  codeHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  codeHeroCatText: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  digitTilesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  digitTile: {
    minWidth: 42,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  digitTileText: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeHeroBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  codeHeroActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 11,
  },
  codeHeroActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  totpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  totpCardLeft: { flex: 1, gap: 4 },
  totpIssuer: { fontSize: 12, fontWeight: '600' },
  totpCode: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  totpCardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totpTimerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 44,
    alignItems: 'center',
  },
  totpTimerText: { fontSize: 12, fontWeight: '700' },
  add2faBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  add2faBtnText: { fontSize: 14, fontWeight: '700' },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  hiddenTitle: { fontSize: 18, fontWeight: '800' },
  hiddenText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
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
  categoryChipText: { fontSize: 13, fontWeight: '500' },
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
  newCategoryChipText: { fontSize: 13, fontWeight: '700' },
  saveButton: { borderRadius: 8, overflow: 'hidden' },
  saveGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '800' },
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
    borderRadius: 8,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  iconPickerScroll: { marginBottom: 20 },
  iconPickerRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalSaveBtn: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  modalSaveGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
});
