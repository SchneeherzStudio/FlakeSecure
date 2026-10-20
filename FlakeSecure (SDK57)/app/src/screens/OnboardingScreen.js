/**
 * ============================================================================
 * FlakeSecure Mobile App - Onboarding Flow Screen (OnboardingScreen)
 * ============================================================================
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated, TextInput, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { AppIcon } from '../components/CategoryIcons';
import PasswordChecklist, { usePasswordValidation } from '../components/PasswordChecklist';
import { formatAuthServerError } from '../utils/passwordPolicy';
import { sendOtp, verifyOtp } from '../utils/api';

const { width } = Dimensions.get('window');

const LANGUAGES = [
  { code: 'en', label: 'English', badge: 'EN' },
  { code: 'de', label: 'Deutsch', badge: 'DE' },
  { code: 'fr', label: 'Français', badge: 'FR' },
  { code: 'es', label: 'Español', badge: 'ES' },
];

export default function OnboardingScreen({ onComplete }) {
  const { register } = useAuth();
  const { t, locale, changeLanguage: setAppLang } = useLanguage();
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState(locale || 'en');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedAge, setAcceptedAge] = useState(false);

  const { evaluation: pwEval, pwnedState, isPasswordReady } = usePasswordValidation(
    password,
    username,
    email
  );
  const canCreateAccount =
    !registering &&
    isPasswordReady &&
    password === confirmPassword &&
    email.trim().includes('@') &&
    username.trim().length > 0 &&
    otpSent &&
    otpCode.trim().length === 6 &&
    acceptedTerms &&
    acceptedAge;

  const totalSteps = 6;

  const changeLanguage = (code) => {
    setSelectedLanguage(code);
    setAppLang(code);
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert(t('error'), t('viewCredential.allFieldsRequired'));
      return;
    }

    setSendingOtp(true);
    try {
      await sendOtp(cleanEmail, 'register');
      setOtpSent(true);
      Alert.alert(t('success'), t('login.otpSentAlert', { email: cleanEmail }));
    } catch (e) {
      Alert.alert(t('error'), e.message || t('login.otpSendFailed'));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleCreateAccount = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const cleanOtp = otpCode.trim();

    if (!cleanEmail || !cleanUsername || !password) {
      Alert.alert(t('error'), t('viewCredential.allFieldsRequired'));
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
      Alert.alert(t('error'), t('onboarding.account.usernameRules'));
      return;
    }
    if (!pwEval.isValid) {
      Alert.alert(t('error'), t('passwordPolicy.errWeakPassword'));
      return;
    }
    if (pwnedState.pwned) {
      Alert.alert(t('error'), t('passwordPolicy.pwnedWarning', { count: pwnedState.count }));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('error'), t('onboarding.account.passwordsDoNotMatch'));
      return;
    }

    if (!otpSent) {
      Alert.alert(t('error'), t('onboarding.account.otpLabel'));
      return;
    }

    if (!cleanOtp || cleanOtp.length !== 6) {
      Alert.alert(t('error'), t('onboarding.account.otpLabel'));
      return;
    }

    if (!acceptedTerms || !acceptedAge) {
      Alert.alert(t('error'), t('login.acceptTermsRequired'));
      return;
    }

    setRegistering(true);
    try {
      const verifyRes = await verifyOtp(cleanEmail, cleanOtp, 'register');
      const otpToken = verifyRes.token;
      await register(cleanEmail, cleanUsername, password, otpToken);
      handleNext();
    } catch (err) {
      Alert.alert(t('error'), formatAuthServerError(err, t));
    } finally {
      setRegistering(false);
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    await AsyncStorage.setItem('app_language', selectedLanguage);
    if (onComplete) onComplete();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.slide}>
            <View style={[styles.welcomeIconBox, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
              <AppIcon name="snowflake" size={48} color={colors.gold} />
            </View>
            <Text style={[styles.welcomeTitle, { color: colors.textMain }]}>
              {t('common.appName').split('Secure')[0]}
              <Text style={{ color: colors.gold }}>Secure</Text>
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.textSub }]}>{t('onboarding.welcome.subtitle')}</Text>
            <View style={styles.featureList}>
              {[
                { icon: 'lock', key: 'feature1' },
                { icon: 'scan', key: 'feature2' },
                { icon: 'shield', key: 'feature3' },
              ].map((item, idx) => (
                <View key={idx} style={[styles.featureItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <View style={[styles.featureIconContainer, { backgroundColor: colors.goldBg }]}>
                    <AppIcon name={item.icon} size={20} color={colors.gold} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.textSub }]}>
                    {t(`onboarding.welcome.${item.key}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.slide}>
            <Text style={[styles.slideTitle, { color: colors.textMain }]}>{t('onboarding.howItWorks.title')}</Text>
            <View style={styles.stepsContainer}>
              {[1, 2, 3].map((step) => (
                <View key={step} style={styles.stepItem}>
                  <LinearGradient
                    colors={colors.goldGradient}
                    style={styles.stepNumber}
                  >
                    <Text style={styles.stepNumberText}>{step}</Text>
                  </LinearGradient>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepTitle, { color: colors.textMain }]}>{t(`onboarding.howItWorks.step${step}Title`)}</Text>
                    <Text style={[styles.stepDesc, { color: colors.textSub }]}>{t(`onboarding.howItWorks.step${step}`)}</Text>
                  </View>
                  {step < 3 && <View style={[styles.stepConnector, { backgroundColor: colors.goldBorder }]} />}
                </View>
              ))}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.slide}>
            <View style={[styles.welcomeIconBox, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder, marginBottom: 16 }]}>
              <AppIcon name="code" size={42} color={colors.gold} />
            </View>
            <Text style={[styles.slideTitle, { color: colors.textMain }]}>{t('onboarding.extension.title')}</Text>
            <Text style={[styles.slideText, { color: colors.textSub }]}>{t('onboarding.extension.description')}</Text>
            <View style={styles.browserCards}>
              <View style={[styles.browserCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <AppIcon name="globe" size={28} color={colors.gold} />
                <Text style={[styles.browserName, { color: colors.textMain }]}>{t('onboarding.extension.chrome')}</Text>
              </View>
              <View style={[styles.browserCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <AppIcon name="globe" size={28} color={colors.gold} />
                <Text style={[styles.browserName, { color: colors.textMain }]}>{t('onboarding.extension.firefox')}</Text>
              </View>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.slide}>
            <View style={[styles.welcomeIconBox, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder, marginBottom: 16 }]}>
              <AppIcon name="globe" size={42} color={colors.gold} />
            </View>
            <Text style={[styles.slideTitle, { color: colors.textMain }]}>{t('onboarding.language.title')}</Text>
            <Text style={[styles.slideText, { color: colors.textSub }]}>{t('onboarding.language.subtitle')}</Text>
            <View style={styles.languageList}>
              {LANGUAGES.map((lang) => {
                const isSelected = selectedLanguage === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.languageItem,
                      { backgroundColor: colors.cardBg, borderColor: colors.border },
                      isSelected && { borderColor: colors.gold, backgroundColor: colors.goldBg }
                    ]}
                    onPress={() => changeLanguage(lang.code)}
                  >
                    <View style={[styles.langBadge, { backgroundColor: isSelected ? colors.gold : colors.inputBg, borderColor: colors.border }]}>
                      <Text style={[styles.langBadgeText, { color: isSelected ? '#ffffff' : colors.textSub }]}>{lang.badge}</Text>
                    </View>
                    <Text style={[
                      styles.languageLabel,
                      { color: isSelected ? colors.textMain : colors.textSub },
                      isSelected && { fontWeight: '700' }
                    ]}>{lang.label}</Text>
                    {isSelected && (
                      <AppIcon name="check" size={16} color={colors.gold} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case 4:
        return (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.slide}
          >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountSlide}>
              <Text style={[styles.slideTitle, { color: colors.textMain }]}>{t('onboarding.account.title')}</Text>
              <Text style={[styles.slideText, { color: colors.textSub }]}>{t('onboarding.account.subtitle')}</Text>
              <View style={[styles.form, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.account.email')}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                      placeholder="you@example.com"
                      placeholderTextColor={colors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                    />
                    <TouchableOpacity
                      style={[styles.sendOtpBtn, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
                      onPress={handleSendOtp}
                      disabled={sendingOtp}
                    >
                      {sendingOtp ? (
                        <ActivityIndicator color={colors.gold} size="small" />
                      ) : (
                        <Text style={[styles.sendOtpText, { color: colors.gold }]}>
                          {otpSent ? t('onboarding.account.resendCode') : t('onboarding.account.sendCode')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {otpSent && (
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.account.otpLabel')}</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { fontSize: 18, letterSpacing: 4, textAlign: 'center', fontWeight: '700', backgroundColor: colors.inputBg, borderColor: colors.gold, color: colors.gold },
                      ]}
                      placeholder="123456"
                      placeholderTextColor={colors.textMuted}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <View style={[styles.otpHintRow, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
                      <AppIcon name="info" size={14} color={colors.gold} />
                      <Text style={[styles.otpHintText, { color: colors.textSub }]}>
                        {t('login.otpNoticeHint')}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.account.username')}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                    placeholder="flakeuser"
                    placeholderTextColor={colors.textMuted}
                    value={username}
                    onChangeText={(text) => setUsername(text.toLowerCase())}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={[styles.inputHint, { color: colors.textMuted }]}>{t('onboarding.account.usernameRuleHint')}</Text>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.account.password')}</Text>
                  <View style={[styles.passwordRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.passwordInput, { color: colors.textMain }]}
                      placeholder="••••••••"
                      placeholderTextColor={colors.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.showBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <AppIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} color={colors.gold} />
                    </TouchableOpacity>
                  </View>
                  <PasswordChecklist password={password} evaluation={pwEval} pwnedState={pwnedState} />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.account.confirmPassword')}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Terms & Privacy Checkbox */}
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: colors.isDark ? '#ffffff' : '#94a3b8', backgroundColor: colors.inputBg },
                  acceptedTerms && { backgroundColor: colors.gold, borderColor: colors.gold }
                ]}>
                  {acceptedTerms && <AppIcon name="check" size={12} color="#ffffff" />}
                </View>
                <Text style={[styles.termsLabel, { color: colors.textSub }]}>
                  {t('login.acceptTermsCheckbox')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAcceptedAge(!acceptedAge)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: colors.isDark ? '#ffffff' : '#94a3b8', backgroundColor: colors.inputBg },
                  acceptedAge && { backgroundColor: colors.gold, borderColor: colors.gold }
                ]}>
                  {acceptedAge && <AppIcon name="check" size={12} color="#ffffff" />}
                </View>
                <Text style={[styles.termsLabel, { color: colors.textSub }]}>
                  {t('login.acceptAgeCheckbox')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createAccountBtn, !canCreateAccount && { opacity: 0.5 }]}
                onPress={handleCreateAccount}
                disabled={!canCreateAccount}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={registering ? ['#333', '#444'] : colors.goldGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtn}
                >
                  {registering ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.createAccountBtnText}>{t('onboarding.account.createButton')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.alreadyHaveAccountBtn}
                onPress={handleFinish}
                disabled={registering}
              >
                <Text style={[styles.alreadyHaveAccountText, { color: colors.gold }]}>
                  {t('onboarding.account.alreadyHaveAccount')}
                </Text>
              </TouchableOpacity>

              {/* Legal Links */}
              <View style={[styles.legalLinksRow, { borderTopColor: colors.border }]}>
                <TouchableOpacity onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/terms')}>
                  <Text style={[styles.legalLinkText, { color: colors.textMuted }]}>{t('login.termsLink')}</Text>
                </TouchableOpacity>
                <Text style={[styles.legalLinkSeparator, { color: colors.textMuted }]}>•</Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/legal')}>
                  <Text style={[styles.legalLinkText, { color: colors.textMuted }]}>{t('login.privacyLink')}</Text>
                </TouchableOpacity>
                <Text style={[styles.legalLinkSeparator, { color: colors.textMuted }]}>•</Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/imprint')}>
                  <Text style={[styles.legalLinkText, { color: colors.textMuted }]}>{t('login.imprintLink')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        );

      case 5:
        return (
          <View style={styles.slide}>
            <View style={[styles.welcomeIconBox, { backgroundColor: colors.successBg, borderColor: colors.successBorder, marginBottom: 20 }]}>
              <AppIcon name="check" size={56} color={colors.success} />
            </View>
            <Text style={[styles.doneTitle, { color: colors.textMain }]}>{t('onboarding.done.title')}</Text>
            <Text style={[styles.doneSubtitle, { color: colors.textSub }]}>{t('onboarding.done.subtitle')}</Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleFinish}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={colors.goldGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                <Text style={styles.doneBtnText}>{t('onboarding.done.button')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.progressContainer}>
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.progressDot,
              { backgroundColor: colors.border },
              idx === currentStep && { width: 20, backgroundColor: colors.gold },
              idx < currentStep && { backgroundColor: colors.goldBorder }
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        {renderStep()}
      </View>

      {currentStep !== 4 && currentStep !== 5 && (
        <View style={styles.navRow}>
          {currentStep > 0 ? (
            <TouchableOpacity onPress={handleBack} style={styles.navBtn}>
              <Text style={[styles.navBtnText, { color: colors.textSub }]}>{t('common.back')}</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={handleNext} style={styles.navBtn}>
            <LinearGradient
              colors={colors.goldGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.navBtnGradient}
            >
              <Text style={styles.navBtnNextText}>{t('onboarding.next')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
      {currentStep === 4 && (
        <View style={styles.navRow}>
          <TouchableOpacity onPress={handleBack} style={styles.navBtn}>
            <Text style={[styles.navBtnText, { color: colors.textSub }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <View />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressContainer: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, paddingVertical: 14
  },
  progressDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  content: { flex: 1, paddingHorizontal: 20 },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  accountSlide: { paddingTop: 10, paddingBottom: 30 },

  welcomeIconBox: {
    width: 76, height: 76, borderRadius: 14,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16
  },
  welcomeTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  welcomeSubtitle: {
    fontSize: 14,
    textAlign: 'center', lineHeight: 20, marginBottom: 24
  },
  featureList: { gap: 12, width: '100%' },
  featureItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 8, padding: 14
  },
  featureIconContainer: {
    width: 36, height: 36, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center'
  },
  featureText: { fontSize: 13, flex: 1, lineHeight: 18 },

  slideTitle: {
    fontSize: 22, fontWeight: '800',
    textAlign: 'center', marginBottom: 8
  },
  slideText: {
    fontSize: 13,
    textAlign: 'center', lineHeight: 20, marginBottom: 20
  },

  stepsContainer: { width: '100%', gap: 0 },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepNumber: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center'
  },
  stepNumberText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  stepContent: { flex: 1, paddingBottom: 18 },
  stepTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  stepDesc: { fontSize: 12, lineHeight: 18 },
  stepConnector: {
    position: 'absolute', left: 15, top: 32, width: 2, height: 18,
  },

  browserCards: { flexDirection: 'row', gap: 12 },
  browserCard: {
    flex: 1, alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 8, padding: 16
  },
  browserName: { fontSize: 13, fontWeight: '700' },

  languageList: { width: '100%', gap: 8 },
  languageItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 8, padding: 12
  },
  langBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  langBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  languageLabel: { fontSize: 15, flex: 1 },

  form: { gap: 14, width: '100%', marginBottom: 16, borderWidth: 1, borderRadius: 10, padding: 18 },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5
  },
  input: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14
  },
  inputHint: {
    fontSize: 11,
    marginTop: 2,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8 },
  passwordInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  showBtn: {
    padding: 10,
    alignItems: 'center', justifyContent: 'center'
  },
  sendOtpBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendOtpText: {
    fontSize: 12,
    fontWeight: '700',
  },
  otpHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  otpHintText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  strengthBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4
  },
  strengthTrack: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: {
    flex: 1, height: 4, borderRadius: 2,
  },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 50 },
  createAccountBtn: { width: '100%', borderRadius: 8, overflow: 'hidden' },
  createAccountBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  gradientBtn: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center'
  },
  alreadyHaveAccountBtn: {
    marginTop: 14, alignItems: 'center', paddingVertical: 10
  },
  alreadyHaveAccountText: {
    fontSize: 13, fontWeight: '700'
  },

  doneTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  doneSubtitle: {
    fontSize: 14,
    textAlign: 'center', lineHeight: 22, marginBottom: 24
  },
  doneButton: { width: '100%', borderRadius: 8, overflow: 'hidden' },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },

  navRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16
  },
  navBtn: { minWidth: 60 },
  navBtnText: { fontSize: 14, fontWeight: '600' },
  navBtnGradient: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8
  },
  navBtnNextText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  termsLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  legalLinkText: {
    fontSize: 11,
    fontWeight: '500',
  },
  legalLinkSeparator: {
    marginHorizontal: 8,
    fontSize: 10,
  },
});
